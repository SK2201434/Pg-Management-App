import { arrayUnion, collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';

import { getFirestoreDb } from '@/config/firebase';
import { isValidPhone } from '@/features/auth/phone';
import {
  buildMatches,
  dismissKey,
  type PhoneAccount,
  type PhoneMatch,
  type UnlinkedResident,
} from '@/features/phoneMatch/phoneMatchModel';
import { toRequestError } from '@/features/properties/propertyService';

// `residentPhones/{phone}/entries/{residentId}` = { ownerUid }. Written when an owner adds a resident by hand, so a
// tenant who registers with that number can be told their owner has to confirm them, without revealing the
// property, room or bed. Removed when the resident is linked to an account or their number changes.
export const residentMarkerRef = (phone: string, residentId: string) => doc(getFirestoreDb(), 'residentPhones', phone, 'entries', residentId);

// Markers already confirmed to exist in this session, so a screen refresh does not read them again.
const ensured = new Set<string>();

/** Makes sure the marker for a resident exists (residents added before markers existed get theirs now). Best effort. */
async function ensureResidentMarker(ownerUid: string, phone: string, residentId: string): Promise<void> {
  const key = `${phone}/${residentId}`;
  if (ensured.has(key)) return;
  try {
    const ref = residentMarkerRef(phone, residentId);
    if (!(await getDoc(ref)).exists()) await setDoc(ref, { ownerUid });
    ensured.add(key);
  } catch {
    // Tried again the next time the suggestions load.
  }
}

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Residents the owner added who have a phone number and no linked account yet. */
async function fetchUnlinkedResidents(ownerUid: string, property: { id: string; name: string }): Promise<UnlinkedResident[]> {
  const snap = await getDocs(query(collection(getFirestoreDb(), 'properties', property.id, 'residents'), where('ownerUid', '==', ownerUid)));
  return snap.docs.flatMap((d): UnlinkedResident[] => {
    const data = d.data() as Record<string, unknown>;
    const phone = text(data.phone);
    if (data.propertyId !== property.id || data.status !== 'active' || data.tenantUid !== undefined || !isValidPhone(phone)) return [];
    return [{ propertyId: property.id, propertyName: property.name, residentId: d.id, name: text(data.name) ?? 'Tenant', phone, roomNumber: text(data.roomNumber), bedLabel: text(data.bedLabel) }];
  });
}

/** The accounts registered with one phone number. A number nobody registered with has none. */
async function fetchAccounts(phone: string): Promise<PhoneAccount[]> {
  const snap = await getDocs(collection(getFirestoreDb(), 'tenantPhones', phone, 'accounts'));
  return snap.docs.flatMap((d): PhoneAccount[] => {
    const name = text(d.data().displayName);
    return d.data().uid === d.id && name ? [{ uid: d.id, displayName: name }] : [];
  });
}

/** The accounts already linked to a property as members. */
async function fetchMemberUids(ownerUid: string, propertyId: string): Promise<Set<string>> {
  const snap = await getDocs(query(collection(getFirestoreDb(), 'properties', propertyId, 'members'), where('ownerUid', '==', ownerUid)));
  return new Set(snap.docs.map((d) => d.id));
}

/** The uids that said "this isn't me" for one resident's marker. Unreadable (no marker yet) means none. */
async function fetchDeclines(phone: string, residentId: string): Promise<string[]> {
  const snap = await getDocs(collection(getFirestoreDb(), 'residentPhones', phone, 'entries', residentId, 'declines'));
  return snap.docs.map((d) => d.id);
}

async function fetchDismissed(ownerUid: string): Promise<Set<string>> {
  const snap = await getDocs(collection(getFirestoreDb(), 'users', ownerUid, 'dismissedMatches'));
  return new Set(snap.docs.map((d) => d.id));
}

/**
 * Suggestions for the owner: residents added by hand whose phone number belongs to a registered tenant.
 * Reads: each property's residents and members, the owner's dismissals, and one lookup per distinct
 * phone number among the unlinked residents. A property or number that cannot be read is skipped
 * rather than failing the whole list.
 */
export async function fetchPhoneMatches(ownerUid: string, properties: readonly { id: string; name: string }[]): Promise<PhoneMatch[]> {
  try {
    const perProperty = await Promise.all(
      properties.map(async (p) => {
        const residents = await fetchUnlinkedResidents(ownerUid, p).catch((): UnlinkedResident[] => []);
        // Only a property with unlinked residents needs its members read.
        const members = residents.length > 0 ? await fetchMemberUids(ownerUid, p.id).catch(() => new Set<string>()) : new Set<string>();
        return { residents, members, id: p.id };
      }),
    );
    const residents = perProperty.flatMap((p) => p.residents);
    if (residents.length === 0) return [];
    for (const r of residents) void ensureResidentMarker(ownerUid, r.phone, r.residentId);
    const phones = [...new Set(residents.map((r) => r.phone))];
    const [accounts, dismissed] = await Promise.all([
      Promise.all(phones.map(async (phone) => [phone, await fetchAccounts(phone).catch((): PhoneAccount[] => [])] as const)),
      fetchDismissed(ownerUid).catch(() => new Set<string>()),
    ]);
    const byPhone = new Map(accounts);
    // Only residents someone registered for can have been declined, so only those are looked at.
    const declined = new Set<string>();
    await Promise.all(
      residents
        .filter((r) => (byPhone.get(r.phone)?.length ?? 0) > 0)
        .map(async (r) => {
          for (const uid of await fetchDeclines(r.phone, r.residentId).catch((): string[] => [])) declined.add(dismissKey(r.residentId, uid));
        }),
    );
    return buildMatches(residents, byPhone, new Map(perProperty.map((p) => [p.id, p.members])), dismissed, declined);
  } catch (error) {
    throw toRequestError(error);
  }
}

/**
 * The owner confirms the match: the existing resident gets the account's uid and the account becomes a
 * member of the property, in one batch. The tenant's app then finds the stay through that membership. No
 * second resident or bed is created. The rules accept it only when the tenant's own phone lookup exists
 * for the resident's number.
 */
export async function linkMatch(match: PhoneMatch, ownerUid: string): Promise<void> {
  // The tenant said this is not them: never link (the rules refuse it too).
  if (match.declined) throw new Error('tenant-declined');
  const db = getFirestoreDb();
  const residentRef = doc(db, 'properties', match.propertyId, 'residents', match.residentId);
  const resident = await getDoc(residentRef);
  const data = resident.data();
  if (!resident.exists() || data?.ownerUid !== ownerUid) throw new Error('resident-not-found');
  if (data.tenantUid !== undefined) throw new Error('resident-already-linked');
  // The marker only exists while the resident is waiting to be confirmed; it is removed with the link.
  const marker = residentMarkerRef(match.phone, match.residentId);
  const hasMarker = (await getDoc(marker).catch(() => null))?.exists() === true;
  const batch = writeBatch(db);
  if (hasMarker) batch.delete(marker);
  batch.update(residentRef, { tenantUid: match.tenantUid, updatedAt: serverTimestamp() });
  batch.set(doc(db, 'properties', match.propertyId, 'members', match.tenantUid), {
    tenantUid: match.tenantUid,
    propertyId: match.propertyId,
    ownerUid,
    displayName: match.tenantName,
    status: 'active',
    source: 'phone-match',
    residentId: match.residentId,
    ...(data.moveInDate ? { checkInAt: data.moveInDate } : {}),
    joinedAt: serverTimestamp(),
  });
  try {
    await batch.commit();
  } catch (error) {
    throw toRequestError(error);
  }
}

/** "Not them": remembered, so this resident and account are not suggested again. */
export async function dismissMatch(match: PhoneMatch, ownerUid: string): Promise<void> {
  try {
    await setDoc(doc(getFirestoreDb(), 'users', ownerUid, 'dismissedMatches', dismissKey(match.residentId, match.tenantUid)), { createdAt: serverTimestamp() });
  } catch (error) {
    throw toRequestError(error);
  }
  // Tell that tenant's app it is not this resident, so it stops saying their owner must confirm them (best effort).
  try {
    await updateDoc(residentMarkerRef(match.phone, match.residentId), { dismissed: arrayUnion(match.tenantUid) });
  } catch {
    // No marker (or none yet): the owner's choice is already saved.
  }
}
