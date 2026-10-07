import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminRole } from "@/lib/auth/roles";
import { getNewOrderCount } from "@/lib/orders/queries";

const NAV_LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/sports", label: "Sports" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/brands", label: "Brands" },
  { href: "/admin/attributes", label: "Attributes" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/shipping", label: "Shipping" },
];

async function logout() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // No Supabase configured (local scaffold): treat as signed out.
  let user = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    user = null;
  }
  if (!user) redirect("/admin/login");

  // Non-admin signed-in users get 403 even with a valid session.
  let role: string | null = null;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("admin_users")
      .select("role,is_active")
      .eq("user_id", user.id)
      .single();
    if (data && data.is_active && isAdminRole(data.role)) role = data.role;
  } catch {
    role = null;
  }
  if (!role) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 text-center">
        <h1 className="font-display text-3xl font-bold">403</h1>
        <p className="mt-2 text-muted">
          This account does not have admin access.
        </p>
        <form action={logout} className="mt-6">
          <button
            type="submit"
            className="rounded-sm border border-line px-4 py-2"
          >
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
    <div className="min-h-screen">
      <header className="border-b border-line bg-pine-950">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
          <p className="font-display text-lg font-bold">
            Waseem <span className="text-gold-400">Sports</span>
            <span className="ml-2 text-sm font-normal text-muted">
              Admin · {role}
            </span>
          </p>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-sm border border-line px-3 py-1.5 text-sm"
            >
              Sign out
            </button>
          </form>
        </div>
        <nav aria-label="Admin sections" className="border-t border-line">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap gap-1 px-4 py-2">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-sm px-3 py-1.5 text-sm text-muted hover:bg-card hover:text-ink"
              >
                {link.label}
                {link.href === "/admin/orders" && newOrderCount > 0 && (
                  <span
                    aria-label={`${newOrderCount} new order${newOrderCount === 1 ? "" : "s"}`}
                    className="ml-2 rounded-sm bg-gold-600 px-1.5 py-0.5 text-xs font-semibold text-bronze-ink"
                  >
                    {newOrderCount}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </nav>
      </header>
      <div className="mx-auto w-full max-w-6xl px-4 py-8">{children}</div>
    </div>
  );
}
