import type { PublicProperty } from "./types";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export const RENT_UNAVAILABLE_LABEL = "Pricing not listed";

const isAmount = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

/** Lowest and highest rent for a property, falling back to its room types; null when no rent is known. */
export function rentBounds(p: Pick<PublicProperty, "rentMinInr" | "rentMaxInr" | "roomTypes">): { min: number; max: number } | null {
  const amounts = [p.rentMinInr, p.rentMaxInr].filter(isAmount);
  if (amounts.length === 0) {
    for (const r of p.roomTypes) amounts.push(...[r.rentMinInr, r.rentMaxInr].filter(isAmount));
  }
  return amounts.length === 0 ? null : { min: Math.min(...amounts), max: Math.max(...amounts) };
}

/** "₹6,000 – ₹9,000", a single amount, or a neutral label. Never invents a price. */
export function formatRentRange(p: Pick<PublicProperty, "rentMinInr" | "rentMaxInr" | "roomTypes">): string {
  const b = rentBounds(p);
  if (!b) return RENT_UNAVAILABLE_LABEL;
  return b.min === b.max ? inr.format(b.min) : `${inr.format(b.min)} – ${inr.format(b.max)}`;
}

export function formatLocation(p: Pick<PublicProperty, "city" | "state">): string | null {
  const parts = [p.city, p.state].filter((s): s is string => typeof s === "string" && s.trim() !== "");
  return parts.length === 0 ? null : parts.join(", ");
}

export const formatSharing = (n: number): string => (n === 1 ? "Single" : `${n}-sharing`);

/** Distinct, valid image URLs in display order: cover first, then the remaining photos. */
export function imageCandidates(p: Pick<PublicProperty, "coverUrl" | "photoUrls">): string[] {
  const out: string[] = [];
  for (const u of [p.coverUrl, ...p.photoUrls]) {
    if (typeof u !== "string" || out.includes(u)) continue;
    try {
      if (new URL(u).protocol === "https:") out.push(u);
    } catch {
      /* ignore malformed URL */
    }
  }
  return out;
}

/** Detail page route for a property; the id is encoded so it is always one path segment. */
export const propertyHref = (id: string): string => `/properties/${encodeURIComponent(id)}`;
