import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/security/logger";

export type AuditEntry = {
  actor: string;
  action: string;
  entity?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
};

/**
 * Append an audit row. Writes go through the service-role client because
 * `audit_logs` is admin-read-only in RLS (writes are server-side by design).
 * Callers must run requireAdmin() first — this helper authorizes nothing.
 * Audit failure never breaks the user action; it is logged server-side.
 */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("audit_logs").insert({
      actor: entry.actor,
      action: entry.action,
      entity: entry.entity ?? null,
      entity_id: entry.entityId ?? null,
      meta: entry.meta ?? {},
    });
    if (error) logger.error("audit insert failed", { action: entry.action, error: error.message });
  } catch (err) {
    logger.error("audit insert threw", {
      action: entry.action,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
