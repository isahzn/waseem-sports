/**
 * Recipient normalisation (spec §5.2).
 *
 * `orders.customer_phone` is free text captured at checkout. WAHA wants
 * `chatId` shaped `<countrycode><number>@c.us` — digits only, no `+`. A number
 * that cannot be normalised is reported as invalid so the outbox row can be
 * recorded `skipped` with a reason instead of retried forever.
 *
 * Pure functions: no network, no DB. Sri Lankan local numbers (`07x xxx xxxx`,
 * landlines `011 x xxx xxx`) map to `94…`.
 */

export type NormalizedRecipient = { ok: true; value: string } | { ok: false; reason: string };

const WAHA_SUFFIX = "@c.us";

function digitsOnly(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

/**
 * Sri Lankan numbers are 9 national digits after the country code. Local
 * mobile/landline numbers start with `0` and are 10 digits including it; some
 * people write 9 digits without the trunk `0`. Accept both, plus `+94`/`0094`.
 */
function toSriLankanMsisdn(raw: string): string | null {
  let d = digitsOnly(raw);
  if (!d) return null;

  if (d.startsWith("0094")) d = d.slice(4);
  if (d.startsWith("94")) d = d.slice(2);
  else if (d.startsWith("0")) d = d.slice(1);

  if (d.length === 9) return `94${d}`;
  if (d.length === 11 && d.startsWith("11")) return null; // 011… with an extra digit
  return null;
}

/** A WAHA `chatId`, or a reason the value cannot be used. */
export function normalizeWhatsApp(raw: string | null | undefined): NormalizedRecipient {
  const value = (raw ?? "").trim();
  if (!value) return { ok: false, reason: "No WhatsApp number on this order." };

  // Already a WAHA chatId (defensive: a settings value might be one).
  if (value.endsWith(WAHA_SUFFIX)) {
    const body = value.slice(0, -WAHA_SUFFIX.length);
    return /^\+?\d{9,15}$/.test(body) ? { ok: true, value: body.replace(/\+/, "") } : { ok: false, reason: "Not a reachable WhatsApp number." };
  }

  const msisdn = toSriLankanMsisdn(value);
  if (msisdn) return { ok: true, value: `${msisdn}${WAHA_SUFFIX}` };

  // Fall back to plain international digits (non-Sri-Lankan number).
  const d = digitsOnly(value);
  if (d.length >= 9 && d.length <= 15) return { ok: true, value: `${d}${WAHA_SUFFIX}` };

  return { ok: false, reason: "Phone number is not in a format WhatsApp can reach." };
}

export function normalizeEmail(raw: string | null | undefined): NormalizedRecipient {
  const value = (raw ?? "").trim();
  if (!value) return { ok: false, reason: "No email address on this order." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) || value.length > 200) {
    return { ok: false, reason: "Email address is not valid." };
  }
  return { ok: true, value };
}

export function normalizeSms(raw: string | null | undefined): NormalizedRecipient {
  const whatsapp = normalizeWhatsApp(raw);
  if (!whatsapp.ok) return whatsapp;
  return { ok: true, value: whatsapp.value.replace(WAHA_SUFFIX, "") };
}

/** Normalise for any channel. Adding a channel means adding a case here. */
export function normalizeRecipient(
  channel: "whatsapp" | "email" | "sms",
  raw: string | null | undefined,
): NormalizedRecipient {
  if (channel === "email") return normalizeEmail(raw);
  if (channel === "sms") return normalizeSms(raw);
  return normalizeWhatsApp(raw);
}
