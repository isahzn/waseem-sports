import { requireAdminOrRedirect } from "@/lib/auth/requireAdmin";
import { getAllowlist } from "@/lib/imagesearch/service";
import { getSetting } from "@/lib/settings";
import { FormError, StatusBadge } from "../../_components/ui";
import { saveAllowlist } from "./actions";

export const metadata = { title: "Image search — Waseem Sports Admin" };
export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Image-search setup (Phase 09). Honest disabled state: with no provider
 * this page says so, keeps the allowlist editable for later, and shows the
 * quota/cached behaviour that will apply when D6 is decided.
 */
export default async function ImageSearchSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminOrRedirect();
  const sp = await searchParams;
  const error = first(sp.error);
  const ok = first(sp.ok);

  const provider = ((await getSetting<string>("image_search.provider_display", "")) as string) || process.env.IMAGE_SEARCH_PROVIDER || "none";
  const allowlist = await getAllowlist();
  const configured = provider.trim().toLowerCase() !== "" && provider.trim().toLowerCase() !== "none";

  return (
    <main className="flex max-w-2xl flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Image search</h1>
        <p className="mt-1 text-sm text-muted">
          Deterministic recommendations for product photos — no AI.{" "}
          <StatusBadge tone={configured ? "green" : "muted"}>{configured ? "Configured" : "Not configured"}</StatusBadge>
        </p>
      </div>
      <FormError message={error} />
      {ok && <p role="status" className="rounded-sm border border-pine-800 bg-pine-900 px-3 py-2 text-sm">{ok}</p>}

      {!configured && (
        <p className="rounded-md border border-dashed border-line bg-card px-4 py-3 text-sm text-muted">
          No provider yet (D6 open) — “Not configured” is normal, not an error. The recommendation UI
          on each product shows this state, quota spends nothing, and manual upload keeps working.
        </p>
      )}

      <section>
        <h2 className="font-display text-xl font-bold">Trusted sources</h2>
        <p className="mt-1 text-sm text-muted">
          Manufacturer and authorized-distributor domains. Recommendations from these rank first —
          finding an image still never grants commercial rights.
        </p>
        <form action={saveAllowlist} className="mt-3 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Allowlisted domains (one per line)</span>
            <textarea
              name="allowlist"
              rows={6}
              defaultValue={allowlist.join("\n")}
              placeholder={"example-brand.com\nlk-distributor.lk"}
              className="rounded-sm border border-line bg-surface px-3 py-2"
            />
          </label>
          <div>
            <button type="submit" className="rounded-sm bg-gold-600 px-4 py-2 text-sm font-semibold text-bronze-ink">
              Save allowlist
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
