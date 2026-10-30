import data from "../../../data/catalog.json";
import type { Catalog } from "./types";

export const catalog: Catalog = data;
export const money = (amount: number | string) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(amount));
