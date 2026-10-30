import "server-only";
import { cache } from "react";
import { catalog } from "./catalog";
import type { Catalog } from "./types";

export const getCatalog = cache(async (): Promise<Catalog> => {
  try {
    const response = await fetch(`${process.env.API_URL || "http://127.0.0.1:4000"}/catalog`, { cache: "no-store", signal: AbortSignal.timeout(3000) });
    if (response.ok) return await response.json();
  } catch { /* Keep editorial pages available while the API restarts. */ }
  return catalog;
});
