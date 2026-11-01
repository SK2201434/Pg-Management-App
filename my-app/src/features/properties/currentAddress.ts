import * as Location from 'expo-location';

/** What "use current location" fills in. Any part the geocoder did not return is `''`. */
export type AddressFields = { location: string; city: string; state: string; postalCode: string };

export type AddressFailureKind =
  | 'permission-denied'
  | 'permission-blocked'
  | 'services-off'
  | 'timeout'
  | 'not-found'
  | 'unknown';

export class CurrentAddressError extends Error {
  constructor(readonly kind: AddressFailureKind, options?: { cause?: unknown }) {
    super(`Could not get the current address (${kind}).`, options);
    this.name = 'CurrentAddressError';
  }
}

const FIX_TIMEOUT_MS = 20_000;

const clean = (value: string | null | undefined) => value?.trim() ?? '';

// Android's geocoder often names a spot by its Plus Code ("8J2W+XX") instead of a street.
const PLUS_CODE = /^[A-Z0-9]{2,8}\+[A-Z0-9]{2,}/i;
const POSTAL_CODE = /\b\d{5,6}\b/;

const sameText = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * The comma-separated parts of the geocoder's one-line address, which is often complete even when
 * its separate fields (city, postal code) are missing, as on recent Android versions.
 */
function formattedParts(geo: Location.LocationGeocodedAddress): { before: string[]; city: string; postalCode: string } {
  const country = clean(geo.country);
  const region = clean(geo.region);
  const segments = clean(geo.formattedAddress)
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '' && !PLUS_CODE.test(part) && !(country && sameText(part, country)));

  // The state segment ("Telangana 500081") anchors the rest: the city is just before it.
  const stateAt = region ? segments.findIndex((part) => part.toLowerCase().startsWith(region.toLowerCase())) : -1;
  const stateSegment = stateAt >= 0 ? segments[stateAt] : '';
  const postalCode = (stateSegment.match(POSTAL_CODE) ?? (region ? null : clean(geo.formattedAddress).match(POSTAL_CODE)))?.[0] ?? '';
  const cityAt = stateAt > 0 ? stateAt - 1 : -1;
  return {
    before: cityAt >= 0 ? segments.slice(0, cityAt) : stateAt < 0 ? segments.slice(0, -1) : [],
    city: cityAt >= 0 ? segments[cityAt] : '',
    postalCode,
  };
}

/** Street-level text from a reverse-geocode result, without repeating the same part twice. */
export function addressFromGeocode(geo: Location.LocationGeocodedAddress): AddressFields {
  const parts: string[] = [];
  const numberedStreet = [clean(geo.streetNumber), clean(geo.street)].filter(Boolean).join(' ');
  const name = PLUS_CODE.test(clean(geo.name)) ? '' : clean(geo.name);
  for (const candidate of [name, numberedStreet, clean(geo.district)]) {
    if (!candidate) continue;
    const lower = candidate.toLowerCase();
    if (parts.some((p) => p.toLowerCase().includes(lower))) continue;
    // A later, longer candidate replaces an earlier part it contains ("12" -> "12 MG Road").
    const containedAt = parts.findIndex((p) => lower.includes(p.toLowerCase()));
    if (containedAt >= 0) parts[containedAt] = candidate;
    else parts.push(candidate);
  }

  const fromLine = clean(geo.formattedAddress) ? formattedParts(geo) : null;
  return {
    location: parts.length > 0 ? parts.join(', ') : (fromLine?.before.join(', ') ?? ''),
    city: clean(geo.city) || clean(geo.subregion) || (fromLine?.city ?? ''),
    state: clean(geo.region),
    postalCode: clean(geo.postalCode) || (fromLine?.postalCode ?? ''),
  };
}

/** User-facing text for a failed lookup. */
export function getCurrentAddressMessage(error: unknown): string {
  const kind = error instanceof CurrentAddressError ? error.kind : 'unknown';
  switch (kind) {
    case 'permission-denied':
      return 'Location permission was not granted. You can type the address instead.';
    case 'permission-blocked':
      return 'Location access is turned off for HOSTELL. Enable it in Settings, or type the address.';
    case 'services-off':
      return 'Turn on your phone’s location services and try again.';
    case 'timeout':
      return 'Could not get your location in time. Move to an open area and try again.';
    case 'not-found':
      return 'No address was found for this location. Please type it in.';
    default:
      return 'Could not get your current location. Please type the address.';
  }
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new CurrentAddressError('timeout')), FIX_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export type Coordinates = { latitude: number; longitude: number };

/**
 * Asks for foreground location permission and takes one high-accuracy position fix. Shared by the
 * address lookup and the "add coordinates later" action, so permission and error handling are the
 * same everywhere.
 */
export async function getCurrentCoordinates(): Promise<Coordinates> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      throw new CurrentAddressError(permission.canAskAgain ? 'permission-denied' : 'permission-blocked');
    }
    if (!(await Location.hasServicesEnabledAsync())) throw new CurrentAddressError('services-off');
    const position = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
    );
    return { latitude: position.coords.latitude, longitude: position.coords.longitude };
  } catch (error) {
    if (error instanceof CurrentAddressError) throw error;
    throw new CurrentAddressError('unknown', { cause: error });
  }
}

const GEOCODE_ATTEMPTS = 3;
const GEOCODE_RETRY_DELAY_MS = 700;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Reverse-geocodes on the device. Right after the permission dialog closes, Android's geocoder can
 * still be paused ("Geocoder is not running") for a moment, so a failed lookup is retried before
 * giving up. Resolves to null when the geocoder answers but has no address for the spot.
 */
async function reverseGeocode(coordinates: Coordinates): Promise<AddressFields | null> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= GEOCODE_ATTEMPTS; attempt += 1) {
    try {
      const [geo] = await withTimeout(Location.reverseGeocodeAsync(coordinates));
      const address = geo ? addressFromGeocode(geo) : null;
      return address && Object.values(address).some((v) => v !== '') ? address : null;
    } catch (error) {
      lastError = error;
      if (__DEV__) console.warn(`[currentAddress] reverse geocode attempt ${attempt} failed`, error);
      if (attempt < GEOCODE_ATTEMPTS) await wait(GEOCODE_RETRY_DELAY_MS);
    }
  }
  throw new CurrentAddressError('unknown', { cause: lastError });
}

/**
 * Current position plus its address, reverse-geocoded on the device (no server of ours, no API
 * key). The coordinates come back so the property can store them; the owner never sees or types
 * them. If the position is found but no address can be, the address fields come back empty (the
 * caller asks the owner to type them) rather than the whole lookup failing and losing the position.
 */
export async function getCurrentAddress(): Promise<AddressFields & { coordinates: Coordinates }> {
  const coordinates = await getCurrentCoordinates();
  const empty: AddressFields = { location: '', city: '', state: '', postalCode: '' };
  try {
    return { ...((await reverseGeocode(coordinates)) ?? empty), coordinates };
  } catch {
    return { ...empty, coordinates };
  }
}
