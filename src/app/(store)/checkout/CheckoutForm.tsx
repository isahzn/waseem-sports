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
    <button type="submit" disabled={pending} className="btn mt-4">
      {pending ? "Placing your order…" : "Place order (cash on delivery)"}
    </button>
  );
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <span role="alert" className="block text-xs font-semibold text-red-300">
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

/**
 * Checkout, laid out exactly like the canonical design: a `.two` split of a
 * fields `.box` and an "Order total" `.box`, with design-labelled inputs
 * (`.f`). All pricing, idempotency, validation and server-action wiring is
 * unchanged — this is the design's presentation of our real form.
 */
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
    <form action={formAction} className="two">
      <input type="hidden" name="idempotency_key" value={idempotencyKey} />

      <div className="box">
        {state.error && (
          <p role="alert" className="mb-4 rounded-sm border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-200">
            {state.error}
          </p>
        )}

        <h2 id="contact-heading">Your details</h2>
        <label>
          Name
          <input name="customer_name" required maxLength={120} autoComplete="name" className="f" />
          <FieldError errors={state.fieldErrors?.customer_name} />
        </label>
        <label>
          Phone <span className="sold">(we call this to confirm your order)</span>
          <input
            name="customer_phone"
            required
            maxLength={30}
            inputMode="tel"
            autoComplete="tel"
            placeholder="077 000 0000"
            className="f"
          />
          <FieldError errors={state.fieldErrors?.customer_phone} />
        </label>
        <label>
          Email <span className="sold">(optional)</span>
          <input name="customer_email" type="email" maxLength={200} autoComplete="email" className="f" />
          <FieldError errors={state.fieldErrors?.customer_email} />
        </label>

        <h2 style={{ marginTop: 24 }}>Delivery address</h2>
        <label>
          Address
          <input name="address_line1" required maxLength={200} autoComplete="address-line1" className="f" />
          <FieldError errors={state.fieldErrors?.address_line1} />
        </label>
        <label>
          Address line 2 <span className="sold">(optional)</span>
          <input name="address_line2" maxLength={200} autoComplete="address-line2" className="f" />
        </label>
        <label>
          City / town
          <input name="city" required maxLength={100} autoComplete="address-level2" className="f" />
          <FieldError errors={state.fieldErrors?.city} />
        </label>
        <label>
          District <span className="sold">(optional)</span>
          <input name="district" maxLength={100} autoComplete="address-level1" className="f" />
        </label>
        <label>
          Postal code <span className="sold">(optional)</span>
          <input name="postal_code" maxLength={20} autoComplete="postal-code" className="f" />
        </label>

        {/* role="group" keeps the radio group named by its visible heading; a
            <legend> can't legally contain the design's h2. */}
        <h2 id="delivery-heading" style={{ marginTop: 24 }}>
          Delivery
        </h2>
        <div role="group" aria-labelledby="delivery-heading">
          {options.map((option) => {
            const free = option.freeOver !== null && subtotal >= option.freeOver;
            const eta = etaText(option);
            return (
              <label key={option.id} className="row cursor-pointer">
                <span className="flex flex-1 items-start gap-2.5">
                  <input
                    type="radio"
                    name="shipping_method"
                    value={option.method}
                    checked={method === option.method}
                    onChange={() => setMethod(option.method)}
                    className="mt-1.5"
                  />
                  <span>
                    <span className="nm">{option.name}</span>
                    {eta && <span className="sold block">Arrives in {eta}</span>}
                    {option.freeOver !== null && (
                      <span className="sold block">Free over {formatLKR(option.freeOver)}</span>
                    )}
                  </span>
                </span>
                <b>{free || option.fee === 0 ? "Free" : formatLKR(option.fee)}</b>
              </label>
            );
          })}
          <FieldError errors={state.fieldErrors?.shipping_method} />
        </div>

        <label className="mt-6">
          Order note <span className="sold">(optional)</span>
          <textarea
            name="notes"
            rows={3}
            maxLength={500}
            className="f"
            placeholder="Delivery instructions, preferred call time…"
          />
          <FieldError errors={state.fieldErrors?.notes} />
        </label>
      </div>

      <div className="box">
        <h2>Order total</h2>

        {lines.map((line) => (
          <div className="row" key={line.variantId}>
            <span>
              <span className="nm">{line.productName}</span>
              <span className="sold block">
                {line.variantName} · {line.qty} × {formatLKR(line.unitPrice)}
              </span>
            </span>
            <b>{formatLKR(line.unitPrice * line.qty)}</b>
          </div>
        ))}

        <div className="row">
          <span>Subtotal</span>
          <b>{formatLKR(subtotal)}</b>
        </div>
        <div className="row">
          <span>Delivery</span>
          <b aria-live="polite">
            {selected ? (freeOverApplied || selected.fee === 0 ? "Free" : formatLKR(selected.fee)) : "—"}
          </b>
        </div>
        <div className="row">
          <span className="nm">Estimated total</span>
          <b>{formatLKR(estimate)}</b>
        </div>

        <p className="sold my-4">
          The shop confirms the final total with the delivery charge when it confirms your order.
        </p>

        <SubmitButton />

        <p className="sold my-4">
          Cash on delivery — pay the rider when your order arrives. No card details are taken online.
        </p>
        <p className="sold my-4">
          <Link href="/cart">Edit your cart</Link>
        </p>
        {contactPhone && (
          <p className="sold my-4">
            Something wrong? Call{" "}
            <a href={`tel:${contactPhone.replace(/\s/g, "")}`}>{contactPhone}</a>.
          </p>
        )}
      </div>
    </form>
  );
}
