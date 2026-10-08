import { z } from "zod";

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw === undefined || raw === "" ? Number.NaN : Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function allowedCurrencies(): string[] {
  const raw = (process.env.MOCK_BANK_CURRENCIES ?? "LKR,USD").toUpperCase();
  return raw
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

export function maxTransferAmount(): number {
  return envNumber("MOCK_BANK_MAX_AMOUNT", 1000000);
}

const uuidField = z.string().uuid("Invalid transfer reference — reload the form and try again.");

const accountField = z
  .string()
  .trim()
  .min(6, "Account number looks too short.")
  .max(24, "Account number is too long.")
  .regex(/^[A-Za-z0-9\- ]+$/, "Account number may only contain letters, numbers, spaces and hyphens.");

const nameField = z.string().trim().min(1, "Recipient name is required.").max(120);

const bankField = z.string().trim().min(1, "Recipient bank is required.").max(120);

const currencyField = z
  .string()
  .trim()
  .toUpperCase()
  .length(3, "Currency must be a 3-letter code.")
  .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter code.")
  .refine((c) => allowedCurrencies().includes(c), "That currency is not enabled for transfers.");

export const transferFormInput = z.object({
  sender_method: z.string().trim().max(60).default("sandbox_balance"),
  sender_account_ref: z.string().trim().min(1, "Source account is required.").max(80),
  recipient_name: nameField,
  recipient_bank: bankField,
  recipient_account: accountField,
  recipient_branch: z.string().trim().max(120).optional().or(z.literal("")),
  recipient_contact: z.string().trim().max(120).optional().or(z.literal("")),
  amount: z
    .number({ invalid_type_error: "Amount must be a number." })
    .positive("Amount must be greater than zero.")
    .max(999999999.99, "Amount is too large.")
    .refine((n) => n <= maxTransferAmount(), "Amount is above the transfer limit."),
  currency: currencyField,
  reference: z.string().trim().max(80).optional().or(z.literal("")),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  idempotency_key: uuidField,
});

export type TransferFormInput = z.infer<typeof transferFormInput>;

export const transferConfirmInput = z.object({
  id: z.string().uuid("Invalid transfer."),
  idempotency_key: uuidField,
  confirm: z.literal(true, { invalid_type_error: "Explicit confirmation is required." }),
});

export type TransferConfirmInput = z.infer<typeof transferConfirmInput>;

export const transferIdInput = z.object({
  id: z.string().uuid("Invalid transfer."),
});

export function emptyToNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

/** Coerce FormData numbers the same way the checkout schemas do. */
export function formAmount(value: FormDataEntryValue | null): number | undefined {
  if (value === null || value === "") return undefined;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : Number.NaN;
}
