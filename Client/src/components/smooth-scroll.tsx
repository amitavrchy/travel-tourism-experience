"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

export function SmoothScroll() {
  const pathname = usePathname();
  useEffect(() => {
    if (
      pathname !== "/" ||
      !window.matchMedia("(pointer: fine)").matches ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const lenis = new Lenis({
      autoRaf: true,
      anchors: true,
      duration: 1.05,
      prevent: (node) =>
        !!node.closest(
          ".dialog,.leaflet-container,.map-sidebar",
        ),
    });
    const observer = new MutationObserver(() => {
      if (document.body.style.overflow === "hidden") lenis.stop();
      else lenis.start();
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["style"],
    });
    return () => {
      observer.disconnect();
      lenis.destroy();
    };
  }, [pathname]);
  return null;
}
