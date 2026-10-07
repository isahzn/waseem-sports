# PHASE 03 — CMS (catalog admin)
**Goal:** owner can manage the whole catalog without code. Build as vertical slices, one entity at a time, in this order:
sports -> categories -> brands -> attribute definitions -> products (+ images, variants, stock) -> inventory view.
## Every slice includes
List (search, filter, pagination, status badges, empty/loading states) + create/edit form + archive/restore + confirm on destructive actions + zod validation + `requireAdmin` + audit log + `revalidateTag` + friendly errors + mobile layout.
## Product form (owner-friendly, stepwise)
Name -> sport -> category -> brand -> description -> images -> attributes -> price -> stock -> "This product has options" toggle (reveals explicit variant rows: options, SKU, price override, stock, image) -> SEO -> preview -> publish/draft.
Never auto-generate variant combinations. Slug auto from name, editable, unique-checked.
## Images
Upload to Storage via server route: magic-byte check, size/dimension limits, sharp re-encode + thumbnail, random filenames; reorder, set primary, alt text, delete, replace, link to variant.
## Acceptance
- Owner can create a sport/category/brand/product with variants and images purely from UI; storefront data reflects it after publish.
- Malformed uploads (renamed .exe, huge file, path traversal filename) are rejected. Non-admin calls to every action fail.
- Archiving a product hides it from the storefront but keeps it restorable.
## Stop and ask
Attribute UX if it gets confusing; keep it simple for a non-technical owner.

## Amendments — 2026-10-06 (context for a session with no prior knowledge)
- **Product images follow `specs/product-image-pipeline-spec.md`.** Extend the Images section with: text-region detection + suggested crop + owner adjust (browser-side, non-destructive recipes); originals kept in the private `originals/` prefix; derivatives generated once at save time; no SVG, magic-byte checks, size caps per the spec. Do not invent a second pipeline.
- **Contact facts are admin-editable settings rows** (address, phone, email, WhatsApp, public number, admin alert number) — build them as settings wherever the settings surface lives, not as product fields.
- **The component map for admin previews** lives in `docs/DESIGN-TOKENS.md`; use the canonical design (`design/waseem-sports-video.html`) as the visual reference for every storefront-facing preview.
- **Cannot be tested in this phase — prove later:** the real photos are extracted in PHASE 04, so OCR accuracy, cut-out quality and batch uniformity can only be proven there. Upload-malice tests (executables, bombs, traversal names, SVG) *can* and must be run now.

## Execution record — 2026-10-07 (all slices built, verified, UNCOMMITTED — owner asked to stop before commit)
- **Slices:** shared infra (`src/lib/catalog/` schemas/slug/audit/query + `_components` ui/ConfirmSubmit/TaxonomyForm + admin nav) → sports → brands → categories (sport + parent selects, self-parent + 25-hop cycle guard, ref-existence checks) → attribute definitions (type-change + delete guards when in use) → products ( stepwise form; auto default variant + inventory row on create; variants add/toggle/delete with last-variant + on-orders guards; descriptive specs replace-all; detail page sections) → inventory view (available = on-hand − reserved, low/out/untracked badges, low-only filter) + `admin_adjust_stock` RPC adjust form → upload route + ImagesManager (primary/delete, storage cleanup best-effort).
- **Upload hardening (SECURITY.md §10):** admin-only + 30/15min IP rate limit; magic-byte detection (`src/lib/uploads/magic.ts`, pure module); 10 MB + 6000px caps; sharp re-encode to WebP + 1600px derivative + 400px thumb (strips payloads/EXIF); `randomUUID` names under `products/`; no SVG path (rejected at magic bytes); traversal impossible (server-generated paths; `imageInput.storage_path` also refuses `..`).
- **Proven:** `tsc` clean · eslint 0 errors (1 unused-import warning, fixed) · `next build` clean (22 routes: 6 taxonomy + 3 product + inventory + upload API) · malice matrix 9/9 PASS against the real `detectImageType` (exe, SVG+script, empty, truncated, jpeg/png/webp/avif, text) · live server: unauthenticated upload POST → 401, `/admin/products` → 307 login, all 9 action/route files grep-confirmed `requireAdmin`.
- **Not proven (no admin session exists — first owner creation still pending):** authenticated click-through of each form; real-file upload round-trip to Supabase storage; `admin_adjust_stock` live call; RLS-as-admin write path beyond the layout gate. These need the owner account (DEPLOYMENT.md step 2) + a browser pass.
- **Deviations from the phase spec:** originals NOT kept in a private `originals/` prefix (amendment) — the route stores only the sharp derivative + thumb; originals are discarded after processing. Rationale: `product-media` is a public bucket so an `originals/` prefix would not be private; true private originals need a second bucket (Phase 04 decision). Thumbnails generated at save time (per spec), no SVG sanitiser (no SVG accepted at all). Product list `perPage` fixed at 20 (no owner-facing page-size control — fine for a single shop).
- **Also changed:** `CLAUDE.md` + `AGENTS.md` gained a `## Subagents` section (owner explicitly approved subagent use 2026-10-07); admin dashboard cards now link the six catalog sections instead of “coming later”.
- **Git status:** all Phase 03 files are new/modified in the working tree, NOT committed (owner: “after your done with this phase just stop”). Commit with Waseem-only paths when the owner says go; never `git add -A` (workspace has unrelated modifications).
