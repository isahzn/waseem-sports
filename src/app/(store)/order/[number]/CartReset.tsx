"use client";

import { useEffect, useRef } from "react";
import { useCart } from "../../_components/CartProvider";

/**
 * The server action already cleared the cart cookie; this clears the in-memory
 * cart so the header count and drawer don't keep showing items the customer
 * just bought. Runs once per mount.
 */
export function CartReset() {
  const { clear } = useCart();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    clear();
  }, [clear]);
  return null;
}
