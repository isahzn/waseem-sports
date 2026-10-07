"use client";

import { useRef, useState } from "react";
import { FormError } from "../../_components/ui";

export type CropState = { error?: string; ok?: boolean };

/**
 * Manual 1:1 crop editor (D20, manual-first). Drag the square, resize with
 * the slider, save → the server applies the normalised recipe, mints new
 * immutable files and re-points the row. Keyboard: arrows nudge, +/- resize.
 * Auto text-detection stays deferred (no current photo contains baked-in text —
 * see docs/EXTRACTED-PHOTOS.md IM-V1).
 */
export function CropEditor({
  imageId,
  src,
  alt,
}: {
  imageId: string;
  src: string;
  alt: string;
}) {
  const [box, setBox] = useState({ x: 0.1, y: 0.1, size: 0.8 });
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<CropState>({});
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  const clampBox = (b: { x: number; y: number; size: number }) => {
    const size = Math.min(1, Math.max(0.05, b.size));
    return {
      size,
      x: Math.min(1 - size, Math.max(0, b.x)),
      y: Math.min(1 - size, Math.max(0, b.y)),
    };
  };

  const toLocal = (clientX: number, clientY: number) => {
    const el = frameRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { fx: (clientX - r.left) / r.width, fy: (clientY - r.top) / r.height };
  };

  const save = async () => {
    setSaving(true);
    setState({});
    try {
      const res = await fetch("/api/admin/images/crop", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: imageId, ...box }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setState({ error: body.error ?? "Could not save the crop." });
      } else {
        setState({ ok: true });
      }
    } catch {
      setState({ error: "Could not save the crop. Try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-md border border-line bg-surface p-3">
      <div
        ref={frameRef}
        role="application"
        aria-label={`Crop editor for ${alt || "product photo"}. Arrow keys move the crop, plus and minus resize it.`}
        tabIndex={0}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 0.05 : 0.01;
          if (e.key === "ArrowLeft") setBox((b) => clampBox({ ...b, x: b.x - step }));
          else if (e.key === "ArrowRight") setBox((b) => clampBox({ ...b, x: b.x + step }));
          else if (e.key === "ArrowUp") setBox((b) => clampBox({ ...b, y: b.y - step }));
          else if (e.key === "ArrowDown") setBox((b) => clampBox({ ...b, y: b.y + step }));
          else if (e.key === "+" || e.key === "=") setBox((b) => clampBox({ ...b, size: b.size + 0.02 }));
          else if (e.key === "-" || e.key === "_") setBox((b) => clampBox({ ...b, size: b.size - 0.02 }));
          else return;
          e.preventDefault();
        }}
        onPointerDown={(e) => {
          const p = toLocal(e.clientX, e.clientY);
          if (!p) return;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          dragRef.current = { dx: p.fx - box.x, dy: p.fy - box.y };
        }}
        onPointerMove={(e) => {
          if (!dragRef.current) return;
          const p = toLocal(e.clientX, e.clientY);
          if (!p) return;
          setBox((b) => clampBox({ ...b, x: p.fx - (dragRef.current?.dx ?? 0), y: p.fy - (dragRef.current?.dy ?? 0) }));
        }}
        onPointerUp={() => {
          dragRef.current = null;
        }}
        className="relative aspect-square w-full touch-none overflow-hidden rounded-sm bg-black select-none"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover opacity-50" />
        <div
          aria-hidden="true"
          className="absolute border-2 border-gold-400"
          style={{
            left: `${box.x * 100}%`,
            top: `${box.y * 100}%`,
            width: `${box.size * 100}%`,
            height: `${box.size * 100}%`,
            boxShadow: "0 0 0 999px rgba(0,0,0,0.55)",
          }}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <span className="font-semibold">Size</span>
        <input
          type="range"
          min={5}
          max={100}
          value={Math.round(box.size * 100)}
          onChange={(e) => setBox((b) => clampBox({ ...b, size: Number(e.target.value) / 100 }))}
          aria-label="Crop size percent"
          className="flex-1"
        />
        <span className="w-12 text-right text-muted">{Math.round(box.size * 100)}%</span>
      </label>
      <FormError message={state.error} />
      {state.ok && <p className="text-sm text-muted">Saved — new files minted, old ones deleted. Reload to see the result.</p>}
      <div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-sm bg-gold-600 px-4 py-2 text-sm font-semibold text-bronze-ink disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save crop"}
        </button>
      </div>
    </div>
  );
}
