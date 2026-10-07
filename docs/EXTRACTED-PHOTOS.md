# Extracted design photos (Phase 04 pre-step — done 2026-10-07)

Source: `design/waseem-sports-video.html` — one `IM[]` array, 11 base64 JPEGs (373 KB total).
Extraction: decoded positionally to `.tmp/extracted/photo-NN.jpg`, eye-confirmed via
contact sheet (`.tmp/extracted/contact-small.jpg`), uploaded to the `product-media`
bucket under `originals/design-extract-<slug>.jpg` with `upsert:true`.

## Positional mapping (eye-confirmed 2026-10-07 — all 11 match)

| # | File | Product | Size | Notes |
|---|---|---|---|---|
| 0 | `originals/design-extract-long-knee-sponge-pair.jpg` | Long Knee Sponge Pair (Allpor) | 480×499 | knee sleeves + packaging |
| 1 | `originals/design-extract-speedo-swimming-cap.jpg` | Speedo Swimming Cap | 480×492 | 5 caps on wall |
| 2 | `originals/design-extract-gold-cup-football.jpg` | Gold Cup Football | 404×413 | ball on red cone |
| 3 | `originals/design-extract-wrist-band.jpg` | Wrist Band | 354×265 | 3 Adidas packs |
| 4 | `originals/design-extract-yonex-double-racket.jpg` | Yonex Double Racket | 449×520 | 2 rackets + case |
| 5 | `originals/design-extract-mikasa-basketball.jpg` | Mikasa Basketball | 520×290 | 3 balls on shelf |
| 6 | `originals/design-extract-hex-dumbbell.jpg` | Hex Dumbbell | 520×356 | single dumbbell (6.6 KB, smallest) |
| 7 | `originals/design-extract-strich-football.jpg` | Strich Football | 520×286 | 4 patterned balls |
| 8 | `originals/design-extract-4-wheel-skating-shoes.jpg` | 4-Wheel Skating Shoes | 269×288 | red/white skates |
| 9 | `originals/design-extract-head-band.jpg` | Head Band | 520×240 | 5 packs |
| 10 | `originals/design-extract-open-gym-glove.jpg` | Open Gym Glove | 498×480 | gloves + packaging |

Hero slides in the design reuse `IM[5]`, `IM[1]`, `IM[6]` (basketball, swim caps, dumbbell).

## VERIFY answers (image-pipeline spec §8)

- **IM-V1 (baked-in prices in images?): NO.** None of the 11 photos contains any text,
  price or label overlay — prices in the design are HTML-rendered. Consequence: the
  D20 auto text-detection/auto-crop has nothing to remove in the current set; the crop
  UI ships manual-first and OCR stays deferred until a real photo with baked-in text appears.
- **IM-V2 (positional mapping): CONFIRMED BY EYE** — table above.
- **IM-V7 (how many photos): 11** product photos. No other images in the canonical file
  (1 video blob = `Background.mp4`, byte-identical per Phase 00).
- Photos carry **no EXIF** (sharp metadata check) and are small (269–520 px, 6–40 KB):
  they are mockup-grade, not print-grade. Real owner uploads will replace them per product.

## Known limitation (recorded, not silently resolved)

`originals/` is **not actually private**: the `product-media` bucket is public-read, so the
prefix is a naming convention only. True private originals need a second private bucket —
deferred to the Phase 04 image-stack decision (IM-V6) with the owner. Nothing secret is in
these files (shop product mockups), so this is acceptable for now.
