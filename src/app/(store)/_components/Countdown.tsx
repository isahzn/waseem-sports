"use client";

import { useEffect, useState } from "react";

function remaining(endsAt: string): number {
  const end = new Date(endsAt).getTime();
  if (Number.isNaN(end)) return 0;
  return Math.max(0, Math.floor((end - Date.now()) / 1000));
}

function format(total: number): string {
  const z = (n: number) => String(n).padStart(2, "0");
  return `${z(Math.floor(total / 3600))}:${z(Math.floor((total % 3600) / 60))}:${z(total % 60)}`;
}

/**
 * The design's `.cd` clock (mockup `setInterval(…)`). Renders nothing when
 * there is no end time, and says so once the deal has ended rather than
 * ticking negative numbers.
 */
export function Countdown({ endsAt }: { endsAt: string }) {
  const [seconds, setSeconds] = useState<number | null>(null);

  useEffect(() => {
    if (!endsAt) return;
    // The first reading is taken after paint (not synchronously in the effect),
    // so the server-rendered placeholder and the first client render agree.
    const tick = () => setSeconds(remaining(endsAt));
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [endsAt]);

  if (!endsAt) return null;
  if (seconds === null) return null;
  if (seconds <= 0) return <b className="cd">Deal ended</b>;

  return (
    <b className="cd" aria-label={`Ends in ${format(seconds)}`}>
      {format(seconds)}
    </b>
  );
}
