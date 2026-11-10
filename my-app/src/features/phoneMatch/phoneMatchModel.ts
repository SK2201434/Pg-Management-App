// Pure model of phone matches: a resident the owner added by hand whose phone number is also the number of
// a registered tenant account. No React, no Firebase.
//
// A match is only a SUGGESTION. Phone numbers are not verified, so nothing links automatically: the owner
// sees the tenant's name next to the resident and confirms (or says "Not them"). Matches are derived, not
// stored, so there is nothing to keep in sync; only the owner's "Not them" choices are saved.
import type { OwnerNotification } from '@/features/notifications/notificationsModel';

/** A resident the owner added (active, valid phone) who is not linked to an account yet. */
export type UnlinkedResident = {
  propertyId: string;
  propertyName: string;
  residentId: string;
  name: string;
  phone: string;
  roomNumber: string | null;
  bedLabel: string | null;
};

/** A registered tenant, as found through the phone lookup. */
export type PhoneAccount = { uid: string; displayName: string };

export type PhoneMatch = {
  /** Stable: the property, the resident and the account. Also the id of its notification. */
  id: string;
  propertyId: string;
  propertyName: string;
  residentId: string;
  residentName: string;
  roomNumber: string | null;
  bedLabel: string | null;
  phone: string;
  tenantUid: string;
  tenantName: string;
  /** The tenant said the number is not theirs. The owner has to correct the details or unassign the bed. */
  declined: boolean;
};

/** The key of a dismissed suggestion: this resident and this account. */
export const dismissKey = (residentId: string, tenantUid: string): string => `${residentId}_${tenantUid}`;

/**
 * Residents paired with the registered accounts that share their phone number. An account that is
 * already a member of the property, or that the owner dismissed for this resident, is left out.
 * Several accounts on one number each produce their own suggestion, so the owner picks the right one.
 */
export function buildMatches(
  residents: readonly UnlinkedResident[],
  accountsByPhone: ReadonlyMap<string, readonly PhoneAccount[]>,
  membersByProperty: ReadonlyMap<string, ReadonlySet<string>>,
  dismissed: ReadonlySet<string>,
  declined: ReadonlySet<string> = new Set(),
): PhoneMatch[] {
  const out: PhoneMatch[] = [];
  for (const r of residents) {
    const members = membersByProperty.get(r.propertyId);
    for (const a of accountsByPhone.get(r.phone) ?? []) {
      if (members?.has(a.uid) || dismissed.has(dismissKey(r.residentId, a.uid))) continue;
      out.push({
        id: `${r.propertyId}_${r.residentId}_${a.uid}`,
        propertyId: r.propertyId,
        propertyName: r.propertyName,
        residentId: r.residentId,
        residentName: r.name,
        roomNumber: r.roomNumber,
        bedLabel: r.bedLabel,
        phone: r.phone,
        tenantUid: a.uid,
        tenantName: a.displayName,
        declined: declined.has(dismissKey(r.residentId, a.uid)),
      });
    }
  }
  return out.sort((x, y) => x.residentName.localeCompare(y.residentName) || x.tenantName.localeCompare(y.tenantName));
}

/** "Room 101 · Bed 2", or null when the resident has no room on record. */
export function placementOf(m: Pick<PhoneMatch, 'roomNumber' | 'bedLabel'>): string | null {
  if (!m.roomNumber) return null;
  return m.bedLabel ? `Room ${m.roomNumber} · ${m.bedLabel}` : `Room ${m.roomNumber}`;
}

/** Matches the tenant disowned: the owner must correct the details or unassign the bed. Shown until resolved. */
export const declinedMatches = (matches: readonly PhoneMatch[]): PhoneMatch[] => matches.filter((m) => m.declined);

/**
 * One notification per suggestion. It has no event time of its own, so it sorts as new while it is open
 * and disappears once the owner links it, corrects the details or unassigns the bed. A match the tenant
 * disowned is a different notification: the number the owner entered is wrong.
 */
export function buildPhoneMatchNotifications(matches: readonly PhoneMatch[], nowMs: number): OwnerNotification[] {
  return matches.map((m) => {
    const where = `${m.propertyName}${placementOf(m) ? `, ${placementOf(m)}` : ''}`;
    if (m.declined) {
      return {
        id: `phone-declined_${m.id}`,
        kind: 'phone-declined' as const,
        title: 'Verify your tenant’s details',
        body: `${m.tenantName} says the phone number you entered for ${m.residentName} (${where}) is not theirs. Please verify the details: correct the number or unassign the bed.`,
        propertyId: m.propertyId,
        propertyName: m.propertyName,
        tenantUid: m.tenantUid,
        residentId: m.residentId,
        atMs: nowMs,
      };
    }
    return {
      id: `phone-match_${m.id}`,
      kind: 'phone-match' as const,
      title: 'Confirm your tenant',
      body: `Your tenant ${m.residentName} (${where}) created a HOSTELL account as ${m.tenantName}. Please confirm their details.`,
      propertyId: m.propertyId,
      propertyName: m.propertyName,
      tenantUid: m.tenantUid,
      residentId: m.residentId,
      atMs: nowMs,
    };
  });
}
