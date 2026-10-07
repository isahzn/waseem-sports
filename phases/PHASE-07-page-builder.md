# PHASE 07 — Homepage & page builder (CMS sections)
## Tasks
1. Section registry: for each type -> zod schema, renderer component (shared by live + preview), editor form. Start with: hero, featured_sports, featured_products, promo_banner, brand_showcase, product_grid, image_text, testimonials, custom_content (markdown, sanitized).
2. Admin: pages list; page editor with add/duplicate/hide/delete/reorder (up/down buttons first; drag-and-drop optional, must have keyboard/touch alternative); product/sport pickers; image picker from Storage; save draft; preview (renders `draft_content` behind admin auth, noindex); publish (`draft_content -> content` via SQL function); status draft/published/archived.
3. Route `/[...slug]` renders published CMS pages; `/` renders page `home` (fallback if none). Predefined layouts (Sport landing, Category landing, Promo landing, Brand showcase) as page templates that pre-create sections.
4. Migrate PHASE 04 hardcoded home composition to the `home` page data (seed it).
## Acceptance
- Owner creates "Special Offers" page and reorders homepage with no deploy. Unpublished edits invisible publicly. Script/HTML injection in any text field renders as text. No TS file generated per page.

## Amendments — 2026-10-06 (context for a session with no prior knowledge)
- **The registry's starting section types come from the canonical design** (`design/waseem-sports-video.html`) via the component map in `docs/DESIGN-TOKENS.md` (hero, promo, category rail, product grid, …). Do not invent types the design never had.
- **The hero section must cover the canonical hero**, which uses an autoplaying background video with a dark veil. Rebuilding that as a CMS component has performance implications (page weight, `prefers-reduced-motion`, mobile data) — keep it behind the section's own toggle and measure the result; do not autoplay blindly on every page.
- **Cannot be tested here — prove later:** preview fidelity only counts in a browser (rendered Draft vs rendered Live must match pixel-for-pixel); XSS acceptance only against real injection strings in every text field.
