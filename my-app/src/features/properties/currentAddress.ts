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

/** Street-level text from a reverse-geocode result, without repeating the same part twice. */
export function addressFromGeocode(geo: Location.LocationGeocodedAddress): AddressFields {
  const parts: string[] = [];
  const numberedStreet = [clean(geo.streetNumber), clean(geo.street)].filter(Boolean).join(' ');
  for (const candidate of [clean(geo.name), numberedStreet, clean(geo.district)]) {
    if (!candidate) continue;
    const lower = candidate.toLowerCase();
    if (parts.some((p) => p.toLowerCase().includes(lower))) continue;
    // A later, longer candidate replaces an earlier part it contains ("12" -> "12 MG Road").
    const containedAt = parts.findIndex((p) => lower.includes(p.toLowerCase()));
    if (containedAt >= 0) parts[containedAt] = candidate;
    else parts.push(candidate);
  }
  return {
    location: parts.join(', '),
    city: clean(geo.city) || clean(geo.subregion),
    state: clean(geo.region),
    postalCode: clean(geo.postalCode),
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

/**
 * Current position plus its address, reverse-geocoded on the device (no server of ours, no API
 * key). The coordinates come back so the property can store them; the owner never sees or types
 * them.
 */
export async function getCurrentAddress(): Promise<AddressFields & { coordinates: Coordinates }> {
  const coordinates = await getCurrentCoordinates();
  try {
    const [geo] = await withTimeout(Location.reverseGeocodeAsync(coordinates));
    const address = geo ? addressFromGeocode(geo) : null;
    if (!address || Object.values(address).every((v) => v === '')) {
      throw new CurrentAddressError('not-found');
    }
    return { ...address, coordinates };
  } catch (error) {
    if (error instanceof CurrentAddressError) throw error;
    throw new CurrentAddressError('unknown', { cause: error });
  }
}
