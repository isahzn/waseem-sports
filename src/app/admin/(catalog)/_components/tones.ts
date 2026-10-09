/**
 * Server-safe tone helpers for admin status pills.
 *
 * These live outside `_components/ui.tsx` on purpose: that file is
 * `"use client"`, so any function imported from it becomes a client
 * reference that a Server Component may render but never *call*
 * (Next.js throws "Attempted to call ... from the server"). The pills
 * themselves (`StatusBadge`) stay in ui.tsx; only the pure mappings live
 * here so server pages can call them during render.
 */
export function visibilityTone(isVisible: boolean): "green" | "muted" {
  return isVisible ? "green" : "muted";
}

export function productStatusTone(
  status: string,
): "gold" | "muted" | "red" {
  if (status === "published") return "gold";
  if (status === "archived") return "red";
  return "muted";
}
