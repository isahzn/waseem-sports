"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { formatLKR } from "@/lib/storefront/money";
import { useCart } from "../_components/CartProvider";
import { placeOrder, type CheckoutState } from "./actions";

/** Plain, serializable delivery option passed down from the server page. */
export type DeliveryOption = {
  id: string;
  name: string;
  method: string;
  fee: number;
  freeOver: number | null;
  estDaysMin: number | null;
  estDaysMax: number | null;
};

export type CheckoutLine = {
  variantId: string;
  productName: string;
  variantName: string;
  unitPrice: number;
  qty: number;
};

/** UUID-shaped key so a double-click or retry maps to ONE order (idempotency). */
function makeIdempotencyKey(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-sm bg-gold-600 px-5 py-3 font-semibold text-bronze-ink disabled:opacity-70"
    >
      {pending ? "Placing your order…" : "Place order (cash on delivery)"}
    </button>
  );
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <span role="alert" className="text-xs font-semibold text-red-300">
      {errors[0]}
    </span>
  );
}

function etaText(option: DeliveryOption): string | null {
  if (option.estDaysMin === null && option.estDaysMax === null) return null;
  if (option.estDaysMin !== null && option.estDaysMax !== null) {
    return option.estDaysMin === option.estDaysMax
      ? `${option.estDaysMin} day${option.estDaysMin === 1 ? "" : "s"}`
      : `${option.estDaysMin}–${option.estDaysMax} days`;
  }
  return option.estDaysMin !== null ? `about ${option.estDaysMin} days` : `about ${option.estDaysMax} days`;
}

const inputClass = "rounded-sm border border-line bg-surface px-3 py-2";

export function CheckoutForm({
  options,
  lines,
  subtotal,
  contactPhone,
}: {
  options: DeliveryOption[];
  lines: CheckoutLine[];
  subtotal: number;
  contactPhone: string | null;
}) {
  const [idempotencyKey] = useState(makeIdempotencyKey);
  const [state, formAction] = useActionState<CheckoutState, FormData>(placeOrder, {});
  const { refresh } = useCart();
  const [method, setMethod] = useState(options[0]?.method ?? "");

  // A stock change under the customer means the cart needs re-pricing.
  useEffect(() => {
    if (state.refreshCart) refresh();
  }, [state.refreshCart, refresh]);

  const selected = options.find((o) => o.method === method) ?? options[0];
  const freeOverApplied = selected?.freeOver !== null && selected?.freeOver !== undefined && subtotal >= selected.freeOver;
  const estimate = selected ? subtotal + (freeOverApplied ? 0 : selected.fee) : subtotal;

  return (
    <form action={formAction} className="grid gap-8 lg:grid-cols-3">
      <input type="hidden" name="idempotency_key" value={idempotencyKey} />

      <div className="flex flex-col gap-6 lg:col-span-2">
        {state.error && (
          <p role="alert" className="rounded-sm border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-200">
            {state.error}
          </p>
        )}

        <section aria-labelledby="contact-heading" className="flex flex-col gap-3 rounded-md border border-line bg-card p-4">
          <h2 id="contact-heading" className="font-display text-xl font-bold">
            Your details
          </h2>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Name</span>
            <input name="customer_name" required maxLength={120} autoComplete="name" className={inputClass} />
            <FieldError errors={state.fieldErrors?.customer_name} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Phone</span>
            <input
              name="customer_phone"
              required
              maxLength={30}
              inputMode="tel"
              autoComplete="tel"
              placeholder="077 000 0000"
              className={inputClass}
            />
            <span className="text-xs text-muted">We call this number to confirm your order.</span>
            <FieldError errors={state.fieldErrors?.customer_phone} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">
              Email <span className="font-normal text-muted">(optional)</span>
            </span>
            <input name="customer_email" type="email" maxLength={200} autoComplete="email" className={inputClass} />
            <FieldError errors={state.fieldErrors?.customer_email} />
          </label>
        </section>

        <section aria-labelledby="address-heading" className="flex flex-col gap-3 rounded-md border border-line bg-card p-4">
          <h2 id="address-heading" className="font-display text-xl font-bold">
            Delivery address
          </h2>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Address</span>
            <input name="address_line1" required maxLength={200} autoComplete="address-line1" className={inputClass} />
            <FieldError errors={state.fieldErrors?.address_line1} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">
              Address line 2 <span className="font-normal text-muted">(optional)</span>
            </span>
            <input name="address_line2" maxLength={200} autoComplete="address-line2" className={inputClass} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold">City / town</span>
              <input name="city" required maxLength={100} autoComplete="address-level2" className={inputClass} />
              <FieldError errors={state.fieldErrors?.city} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold">
                District <span className="font-normal text-muted">(optional)</span>
              </span>
              <input name="district" maxLength={100} autoComplete="address-level1" className={inputClass} />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm sm:max-w-40">
            <span className="font-semibold">
              Postal code <span className="font-normal text-muted">(optional)</span>
            </span>
            <input name="postal_code" maxLength={20} autoComplete="postal-code" className={inputClass} />
          </label>
        </section>

        <fieldset className="flex flex-col gap-3 rounded-md border border-line bg-card p-4">
          <legend className="px-1 font-display text-xl font-bold">Delivery</legend>
          {options.map((option) => {
            const free = option.freeOver !== null && subtotal >= option.freeOver;
            const eta = etaText(option);
            return (
              <label key={option.id} className="flex cursor-pointer items-start gap-3 rounded-sm border border-line p-3">
                <input
                  type="radio"
                  name="shipping_method"
                  value={option.method}
                  checked={method === option.method}
                  onChange={() => setMethod(option.method)}
                  className="mt-1"
                />
                <span className="flex-1 text-sm">
                  <span className="block font-semibold">{option.name}</span>
                  {eta && <span className="block text-xs text-muted">Arrives in {eta}</span>}
                  {option.freeOver !== null && (
                    <span className="block text-xs text-muted">Free over {formatLKR(option.freeOver)}</span>
                  )}
                </span>
                <span className="text-sm font-semibold">{free || option.fee === 0 ? "Free" : formatLKR(option.fee)}</span>
              </label>
            );
          })}
          <FieldError errors={state.fieldErrors?.shipping_method} />
        </fieldset>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">
            Order note <span className="font-normal text-muted">(optional)</span>
          </span>
          <textarea name="notes" rows={3} maxLength={500} className={inputClass} placeholder="Delivery instructions, preferred call time…" />
          <FieldError errors={state.fieldErrors?.notes} />
        </label>
      </div>

      <aside className="h-fit rounded-md border border-line bg-card p-4 lg:sticky lg:top-24">
        <h2 className="font-display text-xl font-bold">Order summary</h2>
        <ul className="mt-3 flex flex-col gap-3">
          {lines.map((line) => (
            <li key={line.variantId} className="flex gap-3 text-sm">
              <span className="flex-1">
                <span className="block font-semibold">{line.productName}</span>
                <span className="block text-xs text-muted">
                  {line.variantName} · {line.qty} × {formatLKR(line.unitPrice)}
                </span>
              </span>
              <span className="font-semibold">{formatLKR(line.unitPrice * line.qty)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 flex flex-col gap-1 border-t border-line pt-3 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd className="font-semibold">{formatLKR(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Delivery</dt>
            <dd className="font-semibold" aria-live="polite">
              {selected ? (freeOverApplied || selected.fee === 0 ? "Free" : formatLKR(selected.fee)) : "—"}
            </dd>
          </div>
          <div className="mt-1 flex justify-between border-t border-line pt-2 text-base">
            <dt className="font-semibold">Estimated total</dt>
            <dd className="font-bold">{formatLKR(estimate)}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-muted">
          The shop confirms the final total with the delivery charge when it confirms your order.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          <SubmitButton />
          <p className="text-xs text-muted">
            Cash on delivery — pay the rider when your order arrives. No card details are taken online.
          </p>
          <Link href="/cart" className="text-xs text-muted underline">
            Edit your cart
          </Link>
          {contactPhone && (
            <p className="text-xs text-muted">
              Something wrong? Call{" "}
              <a href={`tel:${contactPhone.replace(/\s/g, "")}`} className="underline">
                {contactPhone}
              </a>
              .
            </p>
          )}
        </div>
      </aside>
    </form>
  );
}
