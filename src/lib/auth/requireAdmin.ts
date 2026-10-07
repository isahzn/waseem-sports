import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminRole } from "./roles";
import { isAdminRole } from "./roles";

export type AdminSession = {
  userId: string;
  email: string | undefined;
  role: AdminRole;
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
 * Checks Supabase Auth + the `admin_users` row (role + is_active).
 * Throws AuthError(401) when signed out, AuthError(403) when not admin.
 * Call this at the top of every admin server action / route handler.
 * RLS stays on as the second layer — this is not a replacement for it.
 */
export async function requireAdmin(
  allowedRoles?: AdminRole[],
): Promise<AdminSession> {
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

  return { userId: user.id, email: user.email, role: data.role };
}
