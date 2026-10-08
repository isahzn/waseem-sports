import type { NextConfig } from "next";

// Enforced CSP (PHASE 10). `unsafe-inline` for scripts and styles is the
// documented compromise for Next.js App Router without per-request nonces:
// hydration/flight data and Tailwind/design.css need inline execution, so the
// policy cannot use strict `scripts 'self'` without breaking the storefront.
// What it still buys: no external scripts (stored-XSS payloads cannot load
// `evil.js`), no plugins/objects, no framing, form posts stay same-origin.
// `img-src https:` is deliberately broad: product thumbnails come from the
// Supabase storage host (env-defined) and manufacturer domains in admin
// image search. No `upgrade-insecure-requests`: local dev runs plain http.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://fonts.googleapis.com https://fonts.gstatic.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  // GoDaddy uploads the whole app folder (not a standalone trace), so keep
  // the default output. If this ever changes, update PHASE-01's
  // SERVICE_ROLE grep note to cover the new output directory.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
