"use client";

import { useEffect, useRef } from "react";
import { rememberOrder } from "@/lib/storefront/order-memory";

/**
 * Remembers this order on the device so `/account` can list it later. Renders
 * nothing; runs once per mount, like `CartReset` beside it. The values come
 * from the server-rendered order, so nothing is inferred from the URL.
 */
export function RememberOrder({
  number,
  token,
  total,
  placedAt,
  status,
  statusLabel,
}: {
  number: string;
  token: string;
  total: number;
  placedAt: string;
  status: string;
  statusLabel: string;
}) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    if (!number || !token) return;
    rememberOrder({ number, token, total, placedAt, status, statusLabel });
  }, [number, token, total, placedAt, status, statusLabel]);

  return null;
}
