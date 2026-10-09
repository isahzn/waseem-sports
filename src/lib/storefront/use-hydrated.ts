"use client";

import { useSyncExternalStore } from "react";

/**
 * True once this component is running on the client, false during the server
 * render *and* during hydration (React uses `getServerSnapshot` while
 * hydrating, then re-renders with the client snapshot).
 *
 * Any value the browser derives on its own — a device-local list, or the cart
 * count that arrives from the `refreshCart` server action — must be gated
 * behind this. Rendering such a value in the first client pass, or letting it
 * swap mid-hydration, is what throws React #418 ("server rendered text didn't
 * match the client"). It has to live in the component that renders the value,
 * not in a provider above it: a `<Suspense>` boundary can hydrate later, and a
 * provider's effect would then fire too early.
 */
const noopSubscribe = () => () => {};

export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
