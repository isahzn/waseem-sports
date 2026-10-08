/**
 * Contact-link helpers for the storefront.
 *
 * Pure functions (no server imports, no React) so the footer and the contact
 * page build identical links from the same admin-editable settings. The shop's
 * numbers are stored exactly as the owner types them (`077 009 0147`), which is
 * not a usable `tel:` or `wa.me` value, so the conversion lives here once.
 *
 * Nothing is invented: a value that cannot become a working link returns `null`
 * and the caller renders plain text instead of a dead link.
 */

/** Digits only — drops spaces, dashes, dots, brackets and a leading `+`. */
function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** E.164 numbers are 9–15 digits; anything outside that is not dialable. */
function isDialable(value: string): boolean {
  return value.length >= 9 && value.length <= 15;
}

/**
 * `tel:` href for a phone number.
 *
 * A leading `+` is preserved so an already-international number keeps its
 * country code, while a locally-written number stays local — guessing a country
 * code here would change what actually gets dialled.
 */
export function telHref(raw: string): string | null {
  const trimmed = raw.trim();
  const digits = digitsOnly(trimmed);
  if (!isDialable(digits)) return null;
  return `tel:${trimmed.startsWith("+") ? "+" : ""}${digits}`;
}

/**
 * `https://wa.me/…` href for a WhatsApp number.
 *
 * wa.me only accepts a full international number, so the local form this shop
 * stores (`077 009 0147`) has to be converted or the link opens the wrong chat
 * — or no chat. This is a single Sri Lankan shop (its own address and currency
 * settings), so a leading `0` becomes the `94` country code. Numbers that are
 * already international (a `+country` number, or one that starts with the `94`
 * country code) are used as they are. Anything else returns `null` rather than
 * guessing. NOTE for the owner: when the shop ever spans more than one country,
 * this country code belongs in a setting instead of here.
 */
export function whatsappHref(raw: string): string | null {
  const trimmed = raw.trim();
  const digits = digitsOnly(trimmed);
  if (!isDialable(digits)) return null;
  if (trimmed.startsWith("+") || digits.startsWith("94")) return `https://wa.me/${digits}`;
  if (digits.startsWith("0")) {
    const international = `94${digits.slice(1)}`;
    return isDialable(international) ? `https://wa.me/${international}` : null;
  }
  return null;
}
