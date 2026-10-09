import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminRole } from "@/lib/auth/roles";
import { clearAdminSession, hasAdminSession } from "@/lib/auth/passcode";
import { getNewOrderCount } from "@/lib/orders/queries";
import { AdminNav } from "./(catalog)/_components/AdminNav";

/**
 * The admin area's own shell — deliberately not the storefront: a grouped
 * sidebar, a dense working surface and its own header. Everything under
 * /admin is behind the login gate (and every action re-checks the role).
 */
async function logout() {
  "use server";
  await clearAdminSession();
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // No Supabase session to end — the passcode cookie is already cleared.
  }
  redirect("/admin/login");
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Two ways in: the shared-password session (D42) or a Supabase account with
  // an active `admin_users` row. This decides what to render — it authorizes
  // nothing; every action calls requireAdmin() again.
  const passcodeSession = await hasAdminSession();

  // No Supabase configured (local scaffold): treat as signed out.
  let user: { id: string; email?: string } | null = null;
  if (!passcodeSession) {
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      user = data.user;
    } catch {
      user = null;
    }
    if (!user) redirect("/admin/login");
  }

  // Non-admin signed-in users get 403 even with a valid session. A passcode
  // session is the owner's own login and needs no role row.
  let role: string | null = passcodeSession ? "owner" : null;
  if (!passcodeSession && user) {
    try {
      const admin = createAdminClient();
      const { data } = await admin.from("admin_users").select("role,is_active").eq("user_id", user.id).single();
      if (data && data.is_active && isAdminRole(data.role)) role = data.role;
    } catch {
      role = null;
    }
  }
  if (!role) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 text-center">
        <h1 className="font-display text-3xl font-bold">403</h1>
        <p className="mt-2 text-muted">This account does not have admin access.</p>
        <form action={logout} className="mt-6">
          <button type="submit" className="rounded-sm border border-line px-4 py-2">
            Sign out
          </button>
        </form>
      </main>
    );
  }

  // New-orders badge. The query returns 0 on any failure, so the layout can
  // never break because of it.
  const newOrderCount = await getNewOrderCount();

  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-b border-line bg-pine-950 lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0 print:hidden">
        <div className="px-4 py-4">
          <Link href="/admin" className="font-display text-lg font-bold">
            Waseem <span className="text-gold-400">Sports</span>
          </Link>
          <p className="text-xs text-muted">Admin · {role}</p>
        </div>
        <AdminNav newOrderCount={newOrderCount} />
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-pine-950 px-4 py-3 print:hidden">
          <p className="text-sm text-muted">
            {passcodeSession ? "Owner" : `Signed in${user?.email ? ` as ${user.email}` : ""}`}
            <Link href="/" className="ml-3 underline">
              View store ↗
            </Link>
          </p>
          <form action={logout}>
            <button type="submit" className="rounded-sm border border-line px-3 py-1.5 text-sm">
              Sign out
            </button>
          </form>
        </header>
        <div className="px-4 py-6 lg:px-8">{children}</div>
      </div>
    </div>
  );
}
