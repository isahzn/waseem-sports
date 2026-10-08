# PHASE 09 — Image recommendation tool
**Precondition:** D6 decided; search API terms/pricing verified (VERIFY). No LLM. Deterministic.
## Tasks
1. Query builder: templates from product name, brand, sport, category, attributes (e.g. `"{brand} {name} {category}"`, `"... official"`, `"... {key attribute}"`). No hardcoded products.
2. Provider adapter behind an interface; admin-only server route; zod input; rate limit + daily quota; cache results by normalized query; timeouts; failure => friendly message, manual upload still works.
3. Rank/filter: prefer allowlisted manufacturer/authorized-distributor domains (owner-editable list in settings), min dimensions, https; return ~3 with thumbnail, dimensions, source domain + page URL.
4. UI in product form: "Find recommended images" -> pick -> preview -> optional import.
5. Import: server-side fetch with SSRF protection (https only, resolve + block private/link-local/loopback IPs, redirect limits, size/time caps), verify magic bytes, sharp re-encode, store, record `source_url/source_note/license_note`. Show a clear rights warning before import: finding an image does not grant commercial usage rights.
## Acceptance
- SSRF attempts (localhost, 169.254.x, DNS rebinding, huge file, non-image) rejected. Non-admin cannot call it. Quota stops runaway cost.

## Amendments — 2026-10-06 (context for a session with no prior knowledge)
- **Anything imported by this tool enters the product-image pipeline** (`specs/product-image-pipeline-spec.md`): server-side fetch, magic-byte check, `sharp` re-encode, normalised crop, derivatives, provenance filled from the search result. No second code path for imports vs uploads.
- **Extraction of the existing design-embedded photos is PHASE 04's pre-step, not this phase's.** Do not re-derive it here.
- **The rights warning (task 5) is a hard requirement**, not UX copy: finding an image does not grant commercial use. Keep the owner-editable allowlist of manufacturer/distributor domains.
- **Cannot be tested except live:** SSRF protections only against real network paths (localhost, 169.254.x, DNS rebinding, redirect chains); provider APIs, quotas and pricing only against the live search API in a sandbox project.

## Amendments — 2026-10-06 (provider-optional policy; owner directive)
- **No search provider → continue without it.** Build the seam (query builder, provider interface, quota/cache, rights warning, import pipeline) with the recommendation UI hidden behind a "no provider configured" state. Manual upload (Phase 04) is unaffected. The live adapter and the SSRF-vs-real-network proof land when D6 is decided.
- **Acceptance without a provider:** the admin product form shows the disabled state (not an error); no cost is incurred; nothing in the storefront or order flow depends on this tool.

## Execution record — 2026-10-08 (seam built, ships disabled — D6 open)

No provider is configured, so the full seam was built behind the `none` state: deterministic query builder (`lib/imagesearch/queries.ts` — brand/name/category/official/attribute templates, normalized + sha256 cache key), provider interface + registry (`types.ts`, real-vendor connection point documented in the header), rank/filter (`rank.ts` — https-only, 400px min, allowlist-first incl. subdomains, max 3), SSRF-guarded fetch (`ssrf.ts` — https-only, every resolved address must be public incl. IPv4-mapped IPv6, manual redirects max 3 re-validated per hop, 8 MB cap, 10 s timeout; DNS-rebinding TOCTOU recorded in code), service (`service.ts` — zod, rate limit, daily quota counted on provider calls only, 7-day cache, `acknowledge_rights` literal on import, audit `image.search`/`image.import`), and the import path reuses the uploads pipeline via the extracted `lib/uploads/store.ts` (the uploads route was refactored onto it, behavior identical incl. audit `kind`). UI: per-product “Find recommended images” page (explicit navigation = search intent, so viewing a product never spends quota) with disabled state + would-be queries, preview + mandatory rights checkbox + import; owner-editable allowlist at `/admin/settings/image-search` (`store_settings.image_search.domain_allowlist`). Migration `0005_image_search.sql` (cache + quota tables, RLS deny-anon). Gates: harness `.tmp/imagesearch/run.mjs` **60/60** (query snapshots, rank matrix, 19-arg IP matrix, live localhost/link-local rejections with zero connections made) · typecheck 0 · lint 0 errors (5 pre-existing warnings) · build exit 0 with all 4 routes. NOT proven: DB-backed quota/cache/import and SSRF-vs-real-network paths — they land with the D6 provider (migration unapplied here).
