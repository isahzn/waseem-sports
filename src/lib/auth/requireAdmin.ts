import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminRole } from "./roles";
import { isAdminRole } from "./roles";
import { hasAdminSession } from "./passcode";

export type AdminSession = {
  /**
   * The admin's `auth.users` id, or `null` for a passcode session: the shared
   * password has no user row behind it, so anything it writes records
   * `actor: null` in the audit log rather than inventing an identity.
   */
  userId: string | null;
  email: string | undefined;
  role: AdminRole;
  /** How this session authenticated. */
  source: "account" | "passcode";
};

export class AuthError extends Error {
  status: 401 | 403;
  constructor(message: string, status: 401 | 403) {
    super(message);
    this.status = status;
  }
}

/**
 * Authorize the current session as an active admin.
 *
 * Two ways in, checked in this order:
 * 1. the shared-password gate (D42) — the owner's own login, no account needed;
 * 2. Supabase Auth + the `admin_users` row (role + is_active), unchanged.
 *
 * Throws AuthError(401) when signed out, AuthError(403) when not admin.
 * Call this at the top of every admin server action / route handler.
 * RLS stays on as the second layer — this is not a replacement for it.
 */
/**
 * The client an admin write must use: service role, because RLS admin policies
 * key off `auth.uid()`.
 *
 * The catalog actions used the request-scoped client, whose writes are filtered
 * by those policies. That works for an account session and silently does
 * nothing for a shared-password session, which has no Supabase user at all —
 * an UPDATE the policy filters out returns zero rows and no error, so the
 * action reported success for a write that never happened. `requireAdmin()` is
 * what authorizes a write; this is the client that can perform it.
 *
 * Call it ONLY after `requireAdmin()` has returned (it throws for anonymous and
 * non-admin callers, so a reachable write implies an authorized one).
 */
export function adminDb() {
  return createAdminClient();
}

/**
 * Page-level guard: authorize, or send the visitor to the login screen.
 *
 * **Every admin page must call this before it reads anything.** The layout's
 * own `redirect()` is NOT enough: Next renders a layout and its page in
 * parallel, so the page runs — and its payload is streamed into the 307
 * response — before the layout's redirect is applied. Proven 2026-10-07: an
 * anonymous `GET /admin/pages/<id>` returned the whole rendered builder
 * (sections, product ids, SEO fields) inside the redirect body, because the
 * page had already read it with the service-role client. Guarding in the page
 * means the read never happens.
 *
 * Actions do not need this; they call `requireAdmin()` and throw.
 */
export async function requireAdminOrRedirect(allowedRoles?: AdminRole[]): Promise<AdminSession> {
  const session = await requireAdmin(allowedRoles).catch(() => null);
  if (!session) redirect("/admin/login");
  return session;
}

export async function requireAdmin(
  allowedRoles?: AdminRole[],
): Promise<AdminSession> {
  // The shared password authenticates as the owner, so it satisfies every
  // `allowedRoles` list; the role restrictions exist to separate staff from
  // owner, and there is no staff identity behind a shared password.
  if (await hasAdminSession()) {
    return { userId: null, email: undefined, role: "owner", source: "passcode" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new AuthError("Sign in required.", 401);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("admin_users")
    .select("role,is_active")
    .eq("user_id", user.id)
    .single();

  if (error || !data || !data.is_active || !isAdminRole(data.role)) {
    throw new AuthError("Forbidden.", 403);
  }

  if (allowedRoles && !allowedRoles.includes(data.role)) {
    throw new AuthError("Forbidden.", 403);
  }

  return { userId: user.id, email: user.email, role: data.role, source: "account" };
}
