"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

export type HeroSlide = {
  /** Inline gradient from the design (`linear-gradient(120deg,…)`). */
  background: string;
  title: string;
  text: string;
  href: string;
  image: { src: string; alt: string } | null;
};

/**
 * Hero carousel, exactly the mockup's: a horizontal scroll-snap strip of
 * full-width slides, each a gradient + photo layer (opacity .5) + green veil,
 * advancing itself every 4.5s — skipped entirely under
 * prefers-reduced-motion (design L25/L137).
 */
export function Hero({ slides }: { slides: HeroSlide[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (slides.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      const strip = ref.current;
      if (!strip) return;
      const step = strip.clientWidth + 12;
      const atEnd = strip.scrollLeft + step >= strip.scrollWidth - 4;
      strip.scrollTo({ left: atEnd ? 0 : strip.scrollLeft + step, behavior: "smooth" });
    }, 4500);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  return (
    <div className="hero" id="hero" ref={ref}>
      {slides.map((slide) => (
        <div className="slide" key={slide.title} style={{ background: slide.background }}>
          {slide.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={slide.image.src} alt="" decoding="async" />
          )}
          <b className="veil" />
          <h1>{slide.title}</h1>
          <p>{slide.text}</p>
          <Link className="btn" href={slide.href}>
            Shop now
          </Link>
        </div>
      ))}
    </div>
  );
}
