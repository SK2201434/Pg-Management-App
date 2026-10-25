import type { MoveOutPolicy } from '@/features/moveOut/moveOutModel';

/** Time-of-day greeting from the device's local hour (0-23). */
export function greetingFor(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** The first word of the display name, for a friendly greeting; null when there is no usable name. */
export function firstNameOf(displayName: string | null): string | null {
  const first = displayName?.trim().split(/\s+/)[0];
  return first ? first : null;
}

/**
 * Where the signed-in tenant stands, resolved from their own records only:
 * `none` joined no property; `inactive` joined one but the membership is no longer active (or can no
 * longer be read); `unavailable` the property record is missing; `active` a current membership.
 */
/** The tenant's own room and bed, from the resident record the owner created. */
export type StayRoom = { roomNumber: string; bedLabel: string | null; sharing: number | null; /** Monthly rent for the bed, as the owner set it when assigning it. */ rentInr: number | null };

export type TenantStay =
  | { state: 'none' | 'inactive' | 'unavailable' }
  | { state: 'active'; propertyId: string; ownerUid: string; propertyName: string; /** The property's first published photo, if any. */ coverUrl?: string | null; location: string | null; city: string | null; region: string | null; postalCode: string | null; geo: { lat: number; lng: number } | null; contactName: string | null; contactPhone: string | null; joinedMs: number | null; checkInMs: number | null; checkOutMs: number | null; room?: StayRoom | null; /** Labels of the amenities the owner ticked, in the owner's order. */ amenities?: string[]; /** What the owner allows for moving out. */ moveOutPolicy?: MoveOutPolicy };

export function formatJoined(ms: number | null): string | null {
  return ms === null ? null : new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** A tenant may raise requests while the membership is active and the check-out date, if any, has not passed. */
export function canRaiseRequest(stay: TenantStay | undefined, now: number): stay is Extract<TenantStay, { state: 'active' }> {
  return stay?.state === 'active' && (stay.checkOutMs === null || now <= stay.checkOutMs);
}
