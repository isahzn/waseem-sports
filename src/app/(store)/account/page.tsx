import type { Metadata } from "next";
import { AccountView } from "./AccountView";

export const metadata: Metadata = {
  title: "My account — Waseem Sports",
  description: "The Waseem Sports orders placed in this browser, with links back to each one.",
  robots: { index: false, follow: false },
};

/** Thin server route (metadata + noindex); the list itself is device-local. */
export default function AccountPage() {
  return <AccountView />;
}
