// Pure model of changing a tenant's room or bed. No React, no Firebase.
//
// The owner proposes; the tenant accepts or declines; only an accepted proposal can be applied.
//
// Firestore shape (see firestore.rules):
//   properties/{pid}/stayChanges/{tenantUid}   one per tenant (the id is their account uid): ownerUid, tenantUid,
//                                              propertyId, residentId, fromRoomNumber, fromBedLabel, toRoomId,
//                                              toBedId, toRoomNumber, toBedLabel, toSharing, toRentInr?, status,
//                                              createdAt, updatedAt
// Applying moves the resident (room, bed, rent) and its bed claim in one batch.
import { isBedFree } from '@/features/discovery/discoveryModel';
import type { PropertyRoom } from '@/features/properties/propertyTypes';

export type StayChangeStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'applied';
export const STAY_CHANGE_STATUSES: readonly StayChangeStatus[] = ['pending', 'accepted', 'declined', 'cancelled', 'applied'];

export type StayChange = {
  propertyId: string;
  tenantUid: string;
  residentId: string;
  fromRoomNumber: string;
  fromBedLabel: string | null;
  toRoomId: string;
  toBedId: string;
  toRoomNumber: string;
  toBedLabel: string;
  toSharing: number;
  toRentInr: number | null;
  status: StayChangeStatus;
  createdMs: number | null;
  updatedMs: number | null;
};

export const STAY_CHANGE_LABEL: Record<StayChangeStatus, string> = {
  pending: 'Waiting for the tenant',
  accepted: 'Accepted by the tenant',
  declined: 'Declined by the tenant',
  cancelled: 'Cancelled',
  applied: 'Applied',
};

/** An open proposal blocks a new one; a finished one (declined, cancelled, applied) does not. */
export const canPropose = (existing: Pick<StayChange, 'status'> | null): boolean =>
  existing === null || existing.status === 'declined' || existing.status === 'cancelled' || existing.status === 'applied';

export type BedChoice = {
  roomId: string;
  bedId: string;
  roomNumber: string;
  bedLabel: string;
  sharing: number;
  ac: boolean;
  rentInr: number | null;
};

/** Every free bed the tenant could move to: not blocked, not held, and not the bed they have now. */
export function freeBedChoices(rooms: readonly PropertyRoom[], currentBedId: string | null): BedChoice[] {
  return rooms.flatMap((room) =>
    room.beds
      .filter((bed) => bed.id !== currentBedId && isBedFree(bed))
      .map((bed): BedChoice => ({ roomId: room.id, bedId: bed.id, roomNumber: room.roomNumber, bedLabel: bed.label, sharing: room.sharing, ac: room.ac, rentInr: room.rentPerBedInr })),
  );
}

/** "Room 204 · Bed B". */
export const stayLabel = (roomNumber: string, bedLabel: string | null): string => `Room ${roomNumber}${bedLabel ? ` · Bed ${bedLabel}` : ''}`;

/** Whether the owner may apply the change now: the tenant has accepted it. */
export const canApply = (change: Pick<StayChange, 'status'> | null): boolean => change?.status === 'accepted';

/**
 * Only a tenant with an app account can answer a proposal, and an account only works once its email
 * is verified (the security rules require it for everything a tenant does). A resident added by hand
 * with no account has nobody to accept, so their room is not changed this way.
 */
export const canChangeStay = (tenant: { accountUid?: string; source: string; roomNumber: string | null }): boolean =>
  tenant.source === 'added' && typeof tenant.accountUid === 'string' && tenant.roomNumber !== null;
