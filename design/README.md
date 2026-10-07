# design/ — source-of-truth design assets

## Canonical design (build from this)

**`waseem-sports-video.html`** — owner decision 2026-10-06 (see
`specs/phase-00-fix-spec.md` §4.1). Self-contained single-file SPA mockup:
palette, type pairing (Cormorant Garamond + Manrope), hero video backdrop,
commerce routes (`#/`, `#/shop`, `#/product/:i`, `#/cart`, `#/checkout`,
`#/account`, `#/admin`). Full inventory in `docs/AUDIT.md`; tokens in
`docs/DESIGN-TOKENS.md`.

## Loose assets

| File | Status |
|---|---|
| `Logo.png` (1448×1086 PNG, ~1.2 MB) | **Confirmed real brand logo** (owner, 2026-10-06). Referenced by **no** design file. **Wired in 2026-10-07:** served from `public/assets/logo.png` as the site favicon and apple-touch-icon. |
| `Background.mp4` (~3.2 MB MP4) | **Confirmed wanted hero clip** (owner, 2026-10-06); md5-identical to the video inlined in the canonical file (`docs/AUDIT.md` §4). **Served as a real file since 2026-10-07:** `public/assets/bg.mp4` is the storefront's fixed hero backdrop, hidden under `prefers-reduced-motion`. |

## Archive

Everything else that used to live here moved to `unwanted-designs/`
(superseded, never deleted). Nothing in the archive is a build source.
