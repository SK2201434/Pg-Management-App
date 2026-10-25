/** The property address from its stored parts, or null when none is recorded. */
export function formatAddress(parts: { location: string | null; city: string | null; state: string | null; postalCode: string | null }): string | null {
  const text = [parts.location, parts.city, [parts.state, parts.postalCode].filter(Boolean).join(' ')].filter((p) => p && p.trim()).join(', ');
  return text === '' ? null : text;
}

/** A maps link from stored coordinates, else from the address text; null when there is neither. */
export function mapUrl(geo: { lat: number; lng: number } | null, address: string | null): string | null {
  const query = geo ? `${geo.lat},${geo.lng}` : address;
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null;
}

/** A `tel:` link, or null when the number has no usable digits. */
export function telUrl(phone: string | null): string | null {
  const cleaned = phone?.replace(/[^\d+]/g, '') ?? '';
  return cleaned.replace(/\D/g, '').length >= 7 ? `tel:${cleaned}` : null;
}

/** Whole months from `fromMs` to `nowMs` as "3 months completed", or null before one month. */
export function monthsCompleted(fromMs: number | null, nowMs: number): string | null {
  if (fromMs === null || nowMs < fromMs) return null;
  const a = new Date(fromMs);
  const b = new Date(nowMs);
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) months -= 1;
  return months < 1 ? null : `${months} ${months === 1 ? 'month' : 'months'} completed`;
}
