// One property per location. A property claims "location lock" documents, `propertyLocations/{key}`,
// that can only be created once (the rules reject a second create), so a second property at the same
// place is refused even when it belongs to another owner.
//
// Coordinates decide when the property has them (a cell of 4 decimal places, about 11 m, checked
// together with its 8 neighbours). A property without coordinates falls back to its normalized full
// address. The rules cannot recompute the key, so this protects against the app, not against a
// hand-written client; see the notes in firestore.rules.

export type LocationParts = {
  location?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  geo?: { latitude: number; longitude: number } | null;
};

/** Lowercase letters and digits only, so spacing, case and punctuation never make two addresses differ. */
export const normalizeAddressText = (text: string | null | undefined): string => (text ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** cyrb53: a small, stable 53-bit string hash, rendered as lowercase hex for use in a document id. */
export function hashKey(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

const cell = (degrees: number) => Math.round(degrees * 1e4);
const geoKey = (i: number, j: number) => `geo_${hashKey(`${i},${j}`)}`;
const addressKey = (parts: LocationParts) =>
  normalizeAddressText(parts.location) === ''
    ? null
    : `addr_${hashKey([parts.location, parts.city, parts.state, parts.postalCode].map(normalizeAddressText).join('|'))}`;
const hasGeo = (parts: LocationParts) => !!parts.geo && Number.isFinite(parts.geo.latitude) && Number.isFinite(parts.geo.longitude);

/**
 * The lock a property claims. Coordinates decide whenever they were captured (a cell of about
 * 11 m); only a property without coordinates falls back to its full normalized address, which is
 * less precise because owners type areas, not exact addresses.
 */
export function locationKeys(parts: LocationParts): string[] {
  if (hasGeo(parts)) return [geoKey(cell(parts.geo!.latitude), cell(parts.geo!.longitude))];
  const address = addressKey(parts);
  return address ? [address] : [];
}

/**
 * The locks that make a new property a duplicate if any is taken. For coordinates this is the
 * property's own cell and its 8 neighbours, so two points a few metres apart are caught even when
 * they fall either side of a cell edge.
 */
export function locationCheckKeys(parts: LocationParts): string[] {
  if (!hasGeo(parts)) return locationKeys(parts);
  const i = cell(parts.geo!.latitude);
  const j = cell(parts.geo!.longitude);
  const keys: string[] = [];
  for (let di = -1; di <= 1; di += 1) for (let dj = -1; dj <= 1; dj += 1) keys.push(geoKey(i + di, j + dj));
  return keys;
}

export type GeoInput = { latitude: number; longitude: number };

const toCoordinate = (text: string, limit: number): number | null => {
  const t = text.trim();
  if (!/^[-+]?\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Math.abs(n) <= limit ? n : null;
};

/**
 * Reads the two coordinate fields. `geo` is set only when both are valid (latitude within ±90,
 * longitude within ±180); an empty pair is valid and means "no coordinates". Otherwise the
 * message says which field to fix.
 */
export function parseGeo(latText: string, lngText: string): { geo: GeoInput | null; latError?: string; lngError?: string } {
  if (latText.trim() === '' && lngText.trim() === '') return { geo: null };
  const latitude = toCoordinate(latText, 90);
  const longitude = toCoordinate(lngText, 180);
  if (latitude !== null && longitude !== null) return { geo: { latitude, longitude } };
  return {
    geo: null,
    latError: latitude === null ? 'Enter a latitude between -90 and 90.' : undefined,
    lngError: longitude === null ? 'Enter a longitude between -180 and 180.' : undefined,
  };
}

/** Splits a pasted Google Maps pair such as "12.971599, 77.594566"; null when the text is not one. */
export function splitCoordinatePair(text: string): [string, string] | null {
  const m = /^\s*([-+]?\d+(?:\.\d+)?)\s*,\s*([-+]?\d+(?:\.\d+)?)\s*$/.exec(text);
  return m ? [m[1], m[2]] : null;
}
