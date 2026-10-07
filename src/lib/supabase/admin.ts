import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. SERVER ONLY — never import from client components.
 * Bypasses RLS; every use must be preceded by requireAdmin().
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !serviceKey) {
    throw new Error(
      "Supabase admin client misconfigured: missing URL or SERVICE_ROLE key.",
    );
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
