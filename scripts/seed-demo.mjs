// scripts/seed-demo.mjs — seed the dev project with the canonical demo catalog.
//
// Run from the project root:  node scripts/seed-demo.mjs
//
// What it writes (all idempotent — re-running never duplicates or deletes):
//   sports, categories, brands, products, product_variants, inventory,
//   product_images, shipping_rules, pages + page_sections.
// Product photos are extracted from the canonical mockup's inlined base64 and
// uploaded to the public `product-media` bucket as products/demo-NN.jpg plus a
// -thumb derivative (the storefront builds thumb URLs by inserting `-thumb`).
//
// It only ever touches the demo rows defined below: rows it does not recognise
// are left exactly as they are. Nothing is deleted.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BUCKET = "product-media";

// ---------------------------------------------------------------- env + http

function readEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[t.slice(0, eq).replace(/^export\s+/, "").trim()] = v;
  }
  return out;
}

const env = readEnv(path.join(ROOT, ".env"));
const SUPABASE_URL = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const KEY = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!SUPABASE_URL || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}
const REST = `${SUPABASE_URL}/rest/v1`;
const STORAGE = `${SUPABASE_URL}/storage/v1`;
const AUTH = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** One HTTP call. Returns { status, json, text }; never throws on HTTP errors. */
async function call(url, { method = "GET", body, headers = {}, retries = 2 } = {}) {
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(url, {
        method,
        headers: { ...AUTH, ...headers },
        body: body === undefined ? undefined : typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body),
      });
    } catch (e) {
      if (attempt >= retries) return { status: 0, text: String(e), json: null };
      await sleep(400 * (attempt + 1));
      continue;
    }
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (res.status >= 500 && attempt < retries) {
      await sleep(400 * (attempt + 1));
      continue;
    }
    return { status: res.status, json, text };
  }
}

const jsonHeaders = { "Content-Type": "application/json" };
const fail = (msg, detail) => {
  console.error(`\n${msg}`);
  if (detail) console.error(String(detail).slice(0, 500));
  process.exit(1);
};

/** GET with a filter, returns an array (empty on error). */
async function select(table, query) {
  const r = await call(`${REST}/${table}${query}`, { headers: jsonHeaders });
  if (r.status !== 200) fail(`select ${table} failed (${r.status})`, r.text);
  return Array.isArray(r.json) ? r.json : [];
}

/** Upsert on a unique column (requires a real unique constraint). */
async function upsert(table, rows, onConflict) {
  const r = await call(`${REST}/${table}?on_conflict=${onConflict}&select=*`, {
    method: "POST",
    headers: { ...jsonHeaders, Prefer: "resolution=merge-duplicates,return=representation" },
    body: rows,
  });
  if (r.status >= 300 || !Array.isArray(r.json)) fail(`upsert ${table} failed (${r.status})`, r.text);
  return r.json;
}

async function insert(table, rows, { returning = true } = {}) {
  const q = returning ? `?select=*` : "";
  const r = await call(`${REST}/${table}${q}`, {
    method: "POST",
    headers: { ...jsonHeaders, Prefer: returning ? "return=representation" : "return=minimal" },
    body: rows,
  });
  if (r.status >= 300) fail(`insert ${table} failed (${r.status})`, r.text);
  return Array.isArray(r.json) ? r.json : [];
}

async function patch(table, query, body) {
  const r = await call(`${REST}/${table}${query}&select=*`, {
    method: "PATCH",
    headers: { ...jsonHeaders, Prefer: "return=representation" },
    body,
  });
  if (r.status >= 300) fail(`patch ${table} failed (${r.status})`, r.text);
  return Array.isArray(r.json) ? r.json : [];
}

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[()]/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

// ------------------------------------------------------------- demo catalog

const COLOURS = ["Red", "Grey", "Blue", "White", "Green", "Yellow", "Navy", "Pink", "Black", "Maroon"];

/** Sports/categories in the mockup's order (its CATS list, minus "All"). */
// The owner's own running order. Cricket and Tennis are listed because the shop
// presents them as main sports; neither has products yet, and a sport with no
// products renders an honest empty page rather than inventing stock.
const SPORTS = [
  "Football",
  "Basketball",
  "Badminton",
  "Cricket",
  "Tennis",
  "Skating",
  "Swimming",
  "Fitness",
  "Accessories",
];
/** Brands only where the mockup's product name actually mentions one. */
const BRANDS = ["Allpor", "Speedo", "Gold Cup", "Yonex", "Mikasa", "Strich"];

/**
 * The mockup's 11 products, index-aligned with its inlined photo array, with
 * its prices, categories, option dimensions and stock notes.
 */
const PRODUCTS = [
  { name: "Long Knee Sponge Pair (Allpor)", price: 1450, category: "Accessories", brand: "Allpor", photo: 1,
    options: { Pack: ["Pair"] } },
  { name: "Speedo Swimming Cap", price: 250, category: "Swimming", brand: "Speedo", photo: 2,
    options: { Colour: ["Sunset", "Blue", "Orange"] } },
  { name: "Gold Cup Football", price: 1550, category: "Football", brand: "Gold Cup", photo: 3, featured: true },
  { name: "Wrist Band", price: 175, category: "Accessories", brand: null, photo: 4, options: { Colour: COLOURS } },
  { name: "Yonex Double Racket", price: 1950, category: "Badminton", brand: "Yonex", photo: 5, featured: true },
  { name: "Mikasa Basketball", price: 1200, category: "Basketball", brand: "Mikasa", photo: 6, featured: true,
    options: { Size: ["Size 5", "Size 6", "Size 7"] }, stock: 3 },
  { name: "Hex Dumbbell", price: 700, category: "Fitness", brand: null, photo: 7,
    options: { Weight: ["7.5 kg", "10 kg", "12.5 kg", "15 kg"] }, note: "Priced per kg." },
  { name: "Strich Football", price: 1650, category: "Football", brand: "Strich", photo: 8, featured: true },
  { name: "4-Wheel Skating Shoes", price: 5800, category: "Skating", brand: null, photo: 9, featured: true,
    options: { Size: ["S", "M", "L"] } },
  { name: "Head Band", price: 175, category: "Accessories", brand: null, photo: 10, options: { Colour: COLOURS }, stock: 0 },
  { name: "Open Gym Glove", price: 950, category: "Fitness", brand: null, photo: 11 },
];

const DEFAULT_STOCK = 50;
const photoPath = (n) => `products/demo-${String(n).padStart(2, "0")}.jpg`;
const thumbPath = (p) => p.replace(/(\.[a-z]+)$/i, "-thumb$1");

/** Short factual description: only restates the name, category and options. */
function describe(p) {
  const parts = [`${p.name} — ${p.category}.`];
  const dims = Object.entries(p.options ?? {});
  for (const [dim, values] of dims) parts.push(`${dim}: ${values.join(", ")}.`);
  if (p.note) parts.push(p.note);
  return parts.join(" ");
}

const counts = {};
const bump = (key, n = 1) => {
  counts[key] = (counts[key] ?? 0) + n;
};

// -------------------------------------------------------------- storage: photos

/** Pull the mockup's inlined product photos in order. */
function extractPhotos() {
  const file = path.join(ROOT, "design", "waseem-sports-video.html");
  if (!fs.existsSync(file)) fail(`Design source not found: ${file}`);
  const html = fs.readFileSync(file, "utf8");

  const anchors = ["const IM=[", "const IM = [", 'const IM =["'];
  let list = null;
  for (const anchor of anchors) {
    const at = html.indexOf(anchor);
    if (at < 0) continue;
    const from = html.indexOf("[", at);
    const to = html.indexOf("];", from); // base64 never contains ']' or ';'
    if (from < 0 || to < 0) continue;
    try {
      const parsed = JSON.parse(html.slice(from, to + 1));
      if (Array.isArray(parsed) && parsed.every((s) => typeof s === "string")) {
        list = parsed;
        break;
      }
    } catch {
      /* fall through to the regex pass */
    }
  }
  if (!list) {
    // Fallback: every data URL in document order.
    list = (html.match(/data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+/gi) ?? []).slice(0, 24);
  }
  if (!list?.length) fail("Could not extract the inlined product photos from the design source.");
  if (list.length !== PRODUCTS.length) {
    console.log(
      `warning: found ${list.length} inlined images but the demo has ${PRODUCTS.length} products ` +
        `— photos are mapped by position, so check the upload list below`,
    );
  }
  return list;
}

async function ensureBucket() {
  const head = await call(`${STORAGE}/bucket/${BUCKET}`);
  if (head.status === 200) return;
  const made = await call(`${STORAGE}/bucket`, {
    method: "POST",
    headers: jsonHeaders,
    body: { id: BUCKET, name: BUCKET, public: true },
  });
  if (made.status >= 300 && made.status !== 409) {
    fail(`Could not create the ${BUCKET} bucket (${made.status})`, made.text);
  }
}

async function uploadPhoto(objectPath, buffer, contentType) {
  const up = await call(`${STORAGE}/object/${BUCKET}/${objectPath}`, {
    method: "POST",
    headers: { "Content-Type": contentType, "x-upsert": "true", "cache-control": "max-age=31536000" },
    body: buffer,
  });
  if (up.status >= 300) return { ok: false, status: up.status };
  const pub = await call(`${STORAGE}/object/public/${BUCKET}/${objectPath}`, { headers: {} });
  return { ok: pub.status === 200, status: pub.status };
}

async function seedPhotos() {
  await ensureBucket();

  let sharp = null;
  try {
    sharp = createRequire(import.meta.url)("sharp");
  } catch {
    sharp = null;
  }
  console.log(
    sharp
      ? "sharp available — uploading 400px jpeg thumbnails"
      : "sharp not available — uploading the original bytes to the -thumb path too",
  );

  const dataUrls = extractPhotos();
  console.log(`found ${dataUrls.length} inlined photos in the design source\n`);

  const uploaded = [];
  for (const p of PRODUCTS) {
    const dataUrl = dataUrls[p.photo - 1];
    if (!dataUrl) {
      uploaded.push({ path: photoPath(p.photo), ok: false, status: "no source image" });
      continue;
    }
    const match = /^data:(image\/[a-z+]+);base64,(.*)$/i.exec(dataUrl);
    if (!match) {
      uploaded.push({ path: photoPath(p.photo), ok: false, status: "unparsable data url" });
      continue;
    }
    const contentType = match[1];
    const full = Buffer.from(match[2], "base64");
    if (full.length === 0) {
      uploaded.push({ path: photoPath(p.photo), ok: false, status: "empty image" });
      continue;
    }
    let thumb = full;
    if (sharp) {
      try {
        thumb = await sharp(full).resize(400, 400, { fit: "cover" }).jpeg({ quality: 82 }).toBuffer();
      } catch {
        thumb = full;
      }
    }
    const fullRes = await uploadPhoto(photoPath(p.photo), full, contentType);
    const thumbRes = await uploadPhoto(thumbPath(photoPath(p.photo)), thumb, sharp ? "image/jpeg" : contentType);
    const ok = fullRes.ok && thumbRes.ok;
    uploaded.push({ path: photoPath(p.photo), ok, status: `full ${fullRes.status} / thumb ${thumbRes.status}`, product: p.name });
    bump(ok ? "photos uploaded" : "photos FAILED");
  }
  return uploaded;
}

// ------------------------------------------------------------- taxonomy rows

async function seedTaxonomy() {
  const sports = await upsert(
    "sports",
    SPORTS.map((name, i) => ({ slug: slugify(name), name, is_visible: true, sort_order: i })),
    "slug",
  );
  bump("sports", sports.length);
  const sportId = new Map(sports.map((s) => [s.name, s.id]));

  const categories = await upsert(
    "categories",
    SPORTS.map((name, i) => ({
      slug: slugify(name),
      name,
      sport_id: sportId.get(name) ?? null,
      is_visible: true,
      sort_order: i,
    })),
    "slug",
  );
  bump("categories", categories.length);
  const categoryId = new Map(categories.map((c) => [c.name, c.id]));

  const brands = await upsert(
    "brands",
    BRANDS.map((name, i) => ({ slug: slugify(name), name, is_visible: true, sort_order: i })),
    "slug",
  );
  bump("brands", brands.length);
  const brandId = new Map(brands.map((b) => [b.name, b.id]));

  return { sportId, categoryId, brandId };
}

// ------------------------------------------------------------------- products

async function seedProducts({ sportId, categoryId, brandId }) {
  const publishedAt = new Date().toISOString();
  const rows = PRODUCTS.map((p) => ({
    slug: slugify(p.name),
    name: p.name,
    description: describe(p),
    sport_id: sportId.get(p.category) ?? null,
    category_id: categoryId.get(p.category) ?? null,
    brand_id: p.brand ? (brandId.get(p.brand) ?? null) : null,
    base_price: p.price,
    status: "published",
    is_featured: Boolean(p.featured),
    published_at: publishedAt,
  }));

  const products = await upsert("products", rows, "slug");
  bump("products", products.length);
  const bySlug = new Map(products.map((p) => [p.slug, p]));

  // ---- variants: insert the ones that are missing, keep existing ids ----
  const variantPlan = [];
  for (const p of PRODUCTS) {
    const product = bySlug.get(slugify(p.name));
    if (!product) continue;
    const dims = Object.entries(p.options ?? {});
    const wanted = dims.length
      ? dims[0][1].map((value, i) => ({
          name: value,
          options: { [slugify(dims[0][0])]: value },
          sort_order: i,
        }))
      : [{ name: "Default", options: {}, sort_order: 0 }];

    const existing = await select(
      "product_variants",
      `?product_id=eq.${product.id}&deleted_at=is.null&select=id,name,is_default,sort_order`,
    );
    const byName = new Map(existing.map((v) => [v.name, v]));
    const wantedNames = new Set(wanted.map((w) => w.name));

    // The unique index allows one default per product: if a default we are not
    // reusing is in the way, release it before inserting ours.
    const staleDefault = existing.find((v) => v.is_default && v.name !== wanted[0].name);
    if (staleDefault) {
      await patch("product_variants", `?id=eq.${staleDefault.id}`, { is_default: false });
      bump("variants: released stale default");
    }

    const missing = wanted.filter((w) => !byName.has(w.name));
    if (missing.length) {
      const created = await insert(
        "product_variants",
        missing.map((w) => ({
          product_id: product.id,
          name: w.name,
          options: w.options,
          price: null,
          is_default: w.name === wanted[0].name,
          is_active: true,
          sort_order: w.sort_order,
        })),
      );
      bump("variants inserted", created.length);
      for (const v of created) byName.set(v.name, v);
    }
    // Make sure our intended default really is the default.
    const wantedDefault = byName.get(wanted[0].name);
    if (wantedDefault && !wantedDefault.is_default) {
      await patch("product_variants", `?id=eq.${wantedDefault.id}`, { is_default: true });
    }

    for (const w of wanted) {
      const v = byName.get(w.name);
      if (v) variantPlan.push({ product, variant: v });
    }

    // Variants that exist for this product but are not part of the demo set are
    // left untouched (never deleted, never deactivated).
    const extra = existing.filter((v) => !wantedNames.has(v.name)).length;
    if (extra) console.log(`  note: ${p.name} has ${extra} variant(s) outside the demo set — left untouched`);
  }

  // ---- inventory: the trigger creates the row; set the intended counts ----
  const stockRows = [];
  for (const { product, variant } of variantPlan) {
    const def = PRODUCTS.find((p) => slugify(p.name) === product.slug);
    const onHand = def?.stock ?? DEFAULT_STOCK;
    stockRows.push({ variant_id: variant.id, on_hand: onHand, reserved: 0, track_inventory: true });
  }
  if (stockRows.length) {
    const inv = await upsert("inventory", stockRows, "variant_id");
    bump("inventory rows", inv.length);
  }

  // ---- primary image per product (iterate the demo list: a variant that was
  // patched to default above still carries its old flag in memory) ----
  for (const def of PRODUCTS) {
    const product = bySlug.get(slugify(def.name));
    if (!product) continue;
    if (!variantPlan.some((x) => x.product.id === product.id)) continue;
    const want = photoPath(def.photo);
    const existing = await select(
      "product_images",
      `?product_id=eq.${product.id}&select=id,storage_path,is_primary`,
    );
    if (existing.some((i) => i.storage_path === want)) {
      bump("images already present");
      continue;
    }
    if (existing.some((i) => i.is_primary)) {
      // Only this demo product's own images, and only to free the unique
      // one-primary-per-product slot for the demo photo.
      await patch("product_images", `?product_id=eq.${product.id}&storage_path=neq.${encodeURIComponent(want)}`, {
        is_primary: false,
      });
      bump("images: released another primary");
    }
    const created = await insert("product_images", [
      { product_id: product.id, storage_path: want, alt_text: def.name, is_primary: true, sort_order: 0 },
    ]);
    bump("images inserted", created.length);
  }

  return variantPlan.length;
}

// ------------------------------------------------------------ shipping rules

async function seedShipping() {
  const rules = [
    {
      name: "Colombo and suburbs",
      method: "colombo",
      country_codes: ["LK"],
      regions: [],
      fee: 450,
      // No free-delivery threshold: "free over LKR 10,000" was the mockup's
      // claim, not a policy the owner has set (D5). Seeding it back would
      // advertise something the shop has not agreed to. The owner enters a real
      // threshold in /admin/shipping if they decide to offer one.
      free_over: null,
      est_days_min: 1,
      est_days_max: 2,
      is_active: true,
      sort_order: 1,
    },
    {
      name: "Islandwide",
      method: "islandwide",
      country_codes: ["LK"],
      regions: [],
      fee: 700,
      free_over: null, // see the note on the rule above
      est_days_min: 3,
      est_days_max: 5,
      is_active: true,
      sort_order: 2,
    },
  ];

  // shipping_rules has no unique constraint on `method`, so match by name.
  const existing = await select("shipping_rules", "?select=id,name");
  for (const rule of rules) {
    const found = existing.find((r) => r.name === rule.name);
    if (found) {
      await patch("shipping_rules", `?id=eq.${found.id}`, rule);
      bump("shipping rules updated");
    } else {
      await insert("shipping_rules", [rule]);
      bump("shipping rules inserted");
    }
  }
}

// --------------------------------------------------------- pages + sections

const HOME_SECTIONS = [
  {
    type: "hero",
    content: {
      slides: [
        {
          title: "Game on",
          text: "Footballs, basketballs and racquets, ready to play.",
          background: "linear-gradient(120deg,#062418,#0f4a33)",
          href: "/sport/football",
          image_path: photoPath(6),
        },
        {
          title: "New arrivals",
          text: "Skating shoes and swim gear just landed.",
          background: "linear-gradient(120deg,#2b2109,#7a5f1e)",
          href: "/sport/skating",
          image_path: photoPath(2),
        },
        {
          title: "Train at home",
          text: "Dumbbells, gym gloves and more, delivered fast.",
          background: "linear-gradient(120deg,#0a120e,#0b3d2a)",
          href: "/sport/fitness",
          image_path: photoPath(7),
        },
      ],
    },
  },
  { type: "sport_tiles", content: { title: "Shop by sport", limit: 12 } },
  { type: "category_tiles", content: { title: "", limit: 12 } },
  {
    type: "product_grid",
    content: { title: "Best sellers", source: "featured", limit: 5, link_label: "", link_href: "", product_ids: [] },
  },
  {
    type: "product_grid",
    content: { title: "New arrivals", source: "newest", limit: 12, link_label: "See all", link_href: "/shop", product_ids: [] },
  },
];

const DEMO_PAGES = [
  {
    slug: "home",
    title: "Home",
    seo_title: "Waseem Sports — Sports Gear in Sri Lanka",
    seo_description: "Quality sports gear in Colombo, Sri Lanka. Cash on delivery.",
    sections: HOME_SECTIONS,
  },
  {
    slug: "about",
    title: "About Waseem Sports",
    seo_title: "About — Waseem Sports",
    sections: [
      {
        type: "rich_text",
        content: {
          title: "What we sell",
          body:
            "Waseem Sports sells sports gear in Sri Lanka: footballs and basketballs, badminton racquets, swim and skating gear, fitness equipment, and the small kit that goes with them — knee sponges, wrist bands, head bands and gym gloves.\n\nPrices are in LKR and every order is cash on delivery.\n\nThis text is demo copy seeded for the design preview. Replace it from the admin under Content.",
        },
      },
      {
        type: "rich_text",
        content: {
          title: "How ordering works",
          body:
            "Pick your items and check out as a guest — no account needed. We call the number you leave to confirm the order, and you pay the rider in cash when it arrives.\n\nAfter checkout you get a private link with your order number and code. Keep it: it is how you follow the order. You can also look an order up from the Track order page.",
        },
      },
    ],
  },
  {
    slug: "faq",
    title: "Frequently asked questions",
    sections: [
      {
        type: "rich_text",
        content: {
          title: "Delivery and payment",
          body:
            "How much is delivery? — The cost depends on where you are. We confirm it with you before your order is packed.\n" +
            "Can I pay cash? — Yes. Every order is cash on delivery, and no card details are taken online.",
        },
      },
      {
        type: "rich_text",
        content: {
          title: "Orders and returns",
          body:
            "How do I follow my order? — Use the private link from checkout, or the Track order page with your order number and code. We show the status as it moves from confirmed to processing, shipped and delivered.\n" +
            "Can I return something? — Message the shop with your order number and we will tell you what we can do.\n" +
            "Do I need an account? — No. Checkout is guest-only; the orders you place on a device are listed under Account on that device.",
        },
      },
    ],
  },
  {
    slug: "blog/first-kit",
    title: "What to bring to your first game",
    seo_title: "What to bring to your first game — Waseem Sports",
    sections: [
      {
        type: "rich_text",
        content: {
          title: "The short list",
          body:
            "A ball, a spare layer, and something for the knees. If you are playing football, that is a ball (Gold Cup or Strich) plus a long knee sponge pair. For basketball, a Mikasa basketball in the size the court uses — size 5, 6 or 7. Badminton players need the racquet: the Yonex double racket covers two players.\n\nSmall kit makes a difference: a wrist band and a head band keep sweat out of your eyes, and an open gym glove saves your hands if you are lifting between sessions.",
        },
      },
    ],
  },
  {
    slug: "blog/training-at-home",
    title: "Training at home with dumbbells",
    seo_title: "Training at home with dumbbells — Waseem Sports",
    sections: [
      {
        type: "rich_text",
        content: {
          title: "Start where you are",
          body:
            "The hex dumbbell range runs from 7.5 kg to 15 kg, and the dumbbells are priced per kg — so buy the weight you can control for eight clean repetitions, not the heaviest one on the shelf.\n\nBuild the session around three movements you can repeat: a squat, a press and a row. Two or three sessions a week is enough to start. Gym gloves help once the weight goes up, and a head band or wrist band keeps the sweat out of the way.",
        },
      },
    ],
  },
];

async function seedPages() {
  const publishedAt = new Date().toISOString();
  const rows = DEMO_PAGES.map((p) => ({
    slug: p.slug,
    title: p.title,
    layout: "default",
    status: "published",
    seo_title: p.seo_title ?? p.title,
    seo_description: p.seo_description ?? null,
    published_at: publishedAt,
    deleted_at: null,
  }));

  const pages = await upsert("pages", rows, "slug");
  bump("pages", pages.length);
  const bySlug = new Map(pages.map((p) => [p.slug, p]));

  for (const def of DEMO_PAGES) {
    const page = bySlug.get(def.slug);
    if (!page) continue;
    const existing = await select(
      "page_sections",
      `?page_id=eq.${page.id}&select=id,type,sort_order`,
    );

    for (const [i, section] of def.sections.entries()) {
      const found = existing.find((s) => s.type === section.type && s.sort_order === i);
      const body = { content: section.content, is_visible: true, sort_order: i };
      if (found) {
        await patch("page_sections", `?id=eq.${found.id}`, body);
        bump("sections updated");
      } else {
        await insert("page_sections", [{ page_id: page.id, type: section.type, ...body }]);
        bump("sections inserted");
      }
    }
  }
}

// ------------------------------------------------------------------- summary

console.log("Seeding the demo catalog…\n");

const photos = await seedPhotos();
const ids = await seedTaxonomy();
const variants = await seedProducts(ids);
const totalVariants = await select("product_variants", "?select=id&deleted_at=is.null");
await seedShipping();
await seedPages();

console.log("\nPhotos");
for (const u of photos) {
  console.log(`  ${u.ok ? "OK  " : "FAIL"} ${u.path.padEnd(26)} ${u.status}${u.product ? `  (${u.product})` : ""}`);
}

console.log("\nRows touched (this run)");
for (const [k, v] of Object.entries(counts)) console.log(`  ${String(v).padStart(4)}  ${k}`);

const live = await Promise.all([
  select("products", "?status=eq.published&deleted_at=is.null&select=id"),
  select("categories", "?deleted_at=is.null&select=id"),
  select("sports", "?deleted_at=is.null&select=id"),
  select("brands", "?deleted_at=is.null&select=id"),
  select("product_images", "?select=id"),
  select("shipping_rules", "?is_active=eq.true&select=id"),
  select("pages", "?status=eq.published&deleted_at=is.null&select=id"),
]);
console.log("\nNow in the database (whole project)");
[
  "published products",
  "categories",
  "sports",
  "brands",
  "product images",
  "active shipping rules",
  "published pages",
].forEach((label, i) => console.log(`  ${String(live[i].length).padStart(4)}  ${label}`));
console.log(`  ${String(totalVariants.length).padStart(4)}  active product variants`);
console.log(`\nDemo variants ensured: ${variants}`);
console.log("Done. Re-running this script is safe — it only ever upserts the demo rows.");
