# product-image-pipeline — Specification

**Short name:** `product-image-pipeline`
**Created:** 2026-10-06
**Project:** Waseem Sports
**Status:** **draft — proposal for approval.** The owner asked for concrete specifics before PHASE 04 is built. Nothing here is built yet.
**Phase it lands in:** **PHASE 04 (storefront + admin catalog)**; the uploader/crop UI is part of the admin product form. Extraction of the existing photos is a PHASE 04 pre-step (§3).
**Related:** `specs/phase-00-fix-spec.md` (§4.3 photos kept, §F11 crop + text detection), `docs/DESIGN.md`, `docs/SECURITY.md` (§10 uploads), `docs/ARCHITECTURE.md`, `docs/DATABASE.md` (`product_images`, provenance columns).

---

## 1. The request and the decision made

> "Use the best/highest-quality product photo editing approach for the product images. The images should look clean, consistent, professional, and suitable for the ecommerce site." … "The main priority is reliable product images + a working WhatsApp notification system."

**Decision (owner, 2026-10-06):** the approach was chosen as *"propose specifics before PHASE 04"* — this document is that proposal.

**Target result:** every product photo, whatever phone or camera it came from, appears in the same frame, the same scale, the same colour handling and the same sharpness as every other product on the page — with the baked-in price text removed — and with no invented imagery.

---

## 2. Principles (what "best quality" means here, and what it does not)

1. **Real photographs only.** No AI-generated or AI-reconstructed product imagery, no "AI upscale" that invents detail that was never in the file. This is a real shop: a customer must receive exactly what the photo shows. (CLAUDE.md rule 10 — no LLM required for core flows.)
2. **Non-destructive.** The original upload is never modified or discarded. Every crop, cut-out and normalisation is a *recipe* applied to the original, so it can be redone later at higher quality.
3. **Deterministic.** The same input and the same recipe produce byte-identical outputs. No "AI enhancement" pass that makes each run different.
4. **Consistent first, clever second.** A uniform grid comes from fixed framing, scale, margins and colour handling — not from fancy per-image effects.
5. **Cheap at request time.** All processing happens once, at upload. The storefront serves pre-made files from Supabase Storage; nothing is transformed per visit.
6. **Honest colour.** White balance and exposure may be normalised; product colour may not be creatively altered (a red shirt must not become crimson).

---

## 3. Where the images come from (PHASE 04 pre-step)

The existing photos are **base64-embedded inside the design HTML**, not standalone files:

- `design/waseem-sports-video.html` (canonical) — a per-product `IM[]` array; hero slides reference it too.
- `design/Waseem Sports — claude Demo.html` — a category-level `PH{}` map (5 images for 12 products).
- `design/Another design/` — references `/images/*.jpg` paths that **do not exist on disk**.

Therefore PHASE 04 begins with a one-off extraction:

1. Decode the base64 payloads out of the canonical file into real files under a scratch directory.
2. Identify which product each image belongs to (the array is positional — mapping must be confirmed by eye, not assumed).
3. Store them in the private `originals/` prefix of the `product-media` bucket, and record provenance.
4. Run them through the pipeline (§4) and attach them as `product_images` rows.

**VERIFY first:** the owner's note says the photos have prices baked in. Whether that text is *in the images* or *rendered by the HTML* cannot be determined by reading the file (they are opaque base64 blobs) — confirm by viewing the extracted images before writing the crop step.

---

## 4. The pipeline

All server-side stages use **`sharp`**, which is already in the stack (Next.js bundles it). Every stage is a pure function; the recipe is stored so it can be replayed.

### Stage 1 — Ingest validation (`lib/images/validate.ts`)
- Allowlist by **magic bytes**, not extension or client MIME: JPEG, PNG, WebP, AVIF. **No SVG** (SECURITY.md §10).
- Caps: ≤ 25 MB file, ≤ 6000 × 6000 px, ≥ 400 px on the short edge (below that the crop can't reach 1:1 at quality).
- Decompression-bomb guard: check declared dimensions before full decode.
- Reject animated multi-frame inputs (or take frame 1) — decide in code, documented.

### Stage 2 — Geometry: rotate, trim, crop, and remove baked-in text
1. **Auto-rotate** from EXIF orientation, then discard EXIF.
2. **Trim** uniform borders/dead edges (`sharp().trim()`), with a tolerance that does not eat light product edges.
3. **Text detection (the owner's requirement):** find printed text in the photo — the baked-in price labels.
   - **Proposed implementation: browser-side `tesseract.js`.** It runs on the owner's machine during the crop step: no server memory cost, no upload of the image to a third party, instant re-runs while dragging the crop box. The server never needs OCR.
   - It produces text *bounding boxes*; the UI then proposes a crop that contains the product and excludes the detected text, and highlights the offending regions.
4. **Crop:** the owner adjusts the proposed crop (drag/resize/zoom, 1:1 lock). Auto by default, fully manual override — the owner's stated requirement. The crop rectangle is stored **normalised (0–1)** against the original, so it survives re-processing.
5. **Straighten** (optional, manual): ±10° fine rotation for photos shot at an angle. Off by default.

### Stage 3 — Normalise to one canonical frame
This is what makes the grid look uniform.

| Rule | Value |
|---|---|
| Aspect ratio | **1:1** (square) for every product image |
| Master resolution | **2000 × 2000** |
| Subject margin | consistent **6 %** padding on the longest edge, applied by the crop UI's safe-area guide |
| Framing | product centred; horizon/vertical alignment snapped with a grid overlay |
| Scale consistency | **manual per product, guided**: the crop UI overlays the previous product's silhouette guide so the owner matches subject size across the catalog |

For **cut-out images** (§5), scale consistency can be enforced automatically: measure the subject's alpha bounding box and scale it to occupy a target 78 % of the frame — which is what makes a grid of cut-outs read as one system.

### Stage 4 — Colour, tone, sharpness
- Convert to **sRGB**, strip ICC/EXIF/XMP (privacy + size).
- **Optional, owner-toggled** auto-levels: mild white-balance and exposure normalisation towards a consistent target. Never a creative filter, never a colour shift.
- **Never** apply beauty/denoise/skin smoothing (product photography does not need it and it destroys texture).
- Sharpen only at derivative-generation time, tuned per output size (a 400 px card needs different sharpening than a 2000 px master), so cards don't look soft or crunchy.

### Stage 5 — Background (opt-in, per product)
Owner decision: normalise by default; cut-out offered per product.

- **Default: keep the photographed background** (normalised by the crop and levels). Safest, always honest, no artefacts.
- **Optional: cut-out.** Proposed implementation: **`@imgly/background-removal` running in the browser** (IMG.LY's package is available for both browser and Node, runs locally with no API key and no per-image cost). The server only validates the result and re-encodes it.
  - Output keeps **alpha (transparency)**, so the card's background comes from the storefront theme rather than being baked in — this is more flexible than filling with a colour and avoids re-processing if the theme changes.
  - An optional "bake onto paper" variant can fill alpha with the brand tone for the PDP if the owner prefers.
  - Always **revertible** (the original is intact; the cut-out is a recipe flag).
  - Known weak cases to watch and flag in the UI: thin straps/strings, translucent items, lacrosse-style netting, background colours close to the product, and busy backgrounds. When detection confidence is low, the UI says so instead of producing a mangled cut-out.
- Rationale for browser over server: the GoDaddy Node container's memory budget is unknown (**VERIFY**), and an ONNX segmentation model plus a 2000 px image is a real memory spike. Client-side keeps the host small and the UX instant. Server-side remains the documented fallback if the owner's machine struggles.

### Stage 6 — Derivatives
Generated once, at save time, from the master:

| Name | Size | Format | Quality | Used for |
|---|---|---|---|---|
| `master` | 2000 × 2000 | AVIF + JPEG | q 62 AVIF / q 88 JPEG | zoom, future print, archive |
| `lg` | 1200 × 1200 | AVIF + WebP | q 60 | PDP hero |
| `md` | 800 × 800 | AVIF + WebP | q 58 | PDP secondary, quick view |
| `sm` | 400 × 400 | AVIF + WebP | q 55 | product cards, grids, related items |
| `xs` | 200 × 200 | AVIF + WebP | q 55 | cart lines, admin tables, thumbnails |

- **Naming is deterministic and immutable:** `products/{productId}/{contentHash}-{size}.{ext}`, where `contentHash` is a short hash of (original id + recipe). New crop = new hash = new immutable URL, so CDN and browser caches never serve a stale image.
- **Budgets** (measurable acceptance targets): `sm` ≤ 45 KB, `md` ≤ 90 KB, `lg` ≤ 180 KB, `master` ≤ 450 KB (AVIF). A card grid of 12 products must stay well inside a normal page budget.
- The storefront serves AVIF with a WebP fallback (`<picture>`, or Next `Image` with a configured loader). **VERIFY** how Next image optimisation behaves behind GoDaddy's Cloudflare CDN before relying on the default loader — serving the pre-made files directly may be simpler and cheaper.

### Stage 7 — Storage, provenance and alt text
- Bucket `product-media` (already defined in the migration): `originals/` **private** (never served), derivatives under `products/…` public-read.
- `product_images` records: variant link, position, alt text, and the provenance columns (`source_*`) when an image was imported rather than uploaded.
- **Alt text** is authored by the owner, falling back to the product name only when empty (per `docs/DESIGN.md`) — never machine-generated filler.

---

## 5. The admin crop experience (summary of PHASE 04 UI)

```
upload / extract  →  auto-rotate  →  OCR finds text  →  suggested 1:1 crop
      →  owner adjusts (drag, zoom, rotate, safe-area + silhouette guides)
      →  optional cut-out preview  →  save
      →  server: validate → normalise → derivatives → attach to product
```

- Instant local preview (client-side, no round trip) — the owner sees exactly what will be saved.
- **Nothing is destroyed:** re-opening the editor re-loads the original and the stored recipe.
- Batch view: all of a product's images side by side at card size, so inconsistency is visible before saving.
- Mobile usable: 44 px touch targets, per `docs/DESIGN.md`.

---

## 6. Not doing (kept deliberately simple)

- AI generation, AI upscaling, AI "product restoration" — rejected on honesty grounds.
- Per-request image transformation.
- Paid background-removal APIs (remove.bg, fal.ai, Photoroom): they add a key, a cost, and they upload the shop's photos to a third party. The local IMG.LY path needs none of that. *(Revisit only if local quality proves insufficient.)*
- Automatic scale-matching across the whole catalog without human review — a wrong auto-scale silently makes one product look tiny.
- Colour grading beyond neutral exposure/white-balance normalisation.
- Watermarks, borders, per-image frames (the card provides the frame).

---

## 7. Acceptance criteria

| # | Criterion |
|---|---|
| 1 | Every product image in the catalog is exactly 1:1 with identical margins and framing |
| 2 | A grid of 12 cards looks like one shoot — no outliers in scale, tone or sharpness |
| 3 | Baked-in price text is gone from every published image |
| 4 | A 4000 × 3000 phone photo and a 1200 × 900 photo produce the same-looking card |
| 5 | EXIF (including GPS) is stripped from every output |
| 6 | No SVG, no oversized file, no bomb, no non-image passes ingest |
| 7 | Re-cropping a saved image reproduces the previous output exactly for the same recipe |
| 8 | Cut-out is off by default; enabling it on one product does not affect others; it can be reverted |
| 9 | Derivatives meet the size budgets in §4 Stage 6 |
| 10 | Originals remain retrievable and are never served publicly |

**Verification method:** process a batch of the real product photos (once extracted), then inspect the grid as a whole and measure the actual file sizes and dimensions — not just the code path.

---

## 8. Open VERIFY items

| ID | Item | When |
|---|---|---|
| IM-V1 | Whether the baked-in prices are actually *inside* the extracted images | PHASE 04, before building crop |
| IM-V2 | Mapping of the positional `IM[]`/`PH{}` arrays to real products (must be confirmed by eye) | PHASE 04 extraction |
| IM-V3 | Current version, model size and Node/browser compatibility of `@imgly/background-removal`; GPU/WASM performance on the owner's machine | PHASE 04 |
| IM-V4 | `tesseract.js` bundle size and text-detection accuracy on these specific photos | PHASE 04 |
| IM-V5 | Memory ceiling of the GoDaddy Node container for `sharp` at 2000 px (decides server-side vs client-side cut-out) | PHASE 04 |
| IM-V6 | Whether Next's image optimisation works behind GoDaddy's Cloudflare CDN, or whether to serve pre-made derivatives directly | PHASE 04 |
| IM-V7 | How many real product photos exist in total (the design carries both per-product and category-level images) | PHASE 04 extraction |
| IM-V8 | Whether the owner wants the optional "bake onto brand paper" variant for cut-outs | PHASE 04 |
