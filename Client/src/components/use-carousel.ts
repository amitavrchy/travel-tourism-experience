"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export function useCarousel(itemCount: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState({ previous: false, next: itemCount > 3 });
  const refresh = useCallback(() => {
    const rail = ref.current;
    if (rail) setBounds({ previous: rail.scrollLeft > 2, next: rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 2 });
  }, []);
  useEffect(() => {
    const rail = ref.current;
    if (!rail) return;
    const observer = new ResizeObserver(refresh);
    observer.observe(rail);
    rail.addEventListener("scroll", refresh, { passive: true });
    const frame = requestAnimationFrame(refresh);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); rail.removeEventListener("scroll", refresh); };
  }, [refresh, itemCount]);
  const move = useCallback((direction: number) => {
    const rail = ref.current;
    if (!rail) return;
    const card = rail.firstElementChild as HTMLElement | null;
    const gap = parseFloat(getComputedStyle(rail).columnGap) || 0;
    const distance = (card?.getBoundingClientRect().width || rail.clientWidth) + gap;
    rail.scrollBy({ left: direction * distance, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }, []);
  const reset = useCallback(() => ref.current?.scrollTo({ left: 0, behavior: "instant" }), []);
  return { ref, bounds, move, reset };
}
