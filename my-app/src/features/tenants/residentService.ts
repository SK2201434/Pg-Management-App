import { deleteField, doc, getDoc, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';

import { isGender, type Gender } from '@/constants/account';

import { getFirestoreDb } from '@/config/firebase';
import { fetchBedOccupants, toRequestError } from '@/features/properties/propertyService';
import { nextDueMs, periodOf } from '@/features/rent/reminderModel';
import { startOfDay, type PaymentMethod } from '@/features/rent/rentModel';
import { ensureRentCharge, recordPayment } from '@/features/rent/rentService';
import type { NewResident, ResidentEdit } from '@/features/tenants/addTenantModel';

/** The chosen bed is no longer free (blocked, or another resident holds it). */
export class BedUnavailableError extends Error {
  constructor() {
    super('This bed is no longer available.');
    this.name = 'BedUnavailableError';
  }
}

export type ResidentInput = NewResident & {
  /** Fixed for one form, so a retry of the same save rewrites the same documents. */
  residentId: string;
  roomId: string;
  bedId: string;
  roomNumber: string;
  bedLabel: string;
  sharing: number;
  /**
   * Set when the tenant comes from an approved stay request: the same batch then also approves the
   * request and adds them as a member, so they appear in the property's tenants and see their stay.
   */
  link?: { tenantUid: string; tenantName: string };
  /** Rent collected on move-in day: it pays the first cycle, up to the tenant's next due date. */
  collect?: {
    method: PaymentMethod;
    reference: string | null;
    /** Less than the rent when only part was collected; the rest then falls due within a week. */
    amountInr: number;
  };
};

const DAY_MS = 86_400_000;

/** What saving a tenant did besides adding them. */
export type AddResidentResult = { rentRecorded: boolean | null };

/**
 * Adds the tenant (see `addResident`), then, when the owner collected rent at move-in, records that
 * first cycle: a charge for the month ending at the tenant's first due date, paid in full. The charge
 * needs the resident to exist (its rule reads the stored document), so it cannot share the batch. If
 * this second step fails the tenant is still added, and the result says the payment was not recorded.
 */
export async function createResident(propertyId: string, ownerUid: string, input: ResidentInput): Promise<AddResidentResult> {
  await addResident(propertyId, ownerUid, input);
  if (!input.collect) return { rentRecorded: null };
  try {
    const cycleDueMs = nextDueMs(input.moveInMs, input.moveInMs);
    const partial = input.collect.amountInr < input.rentInr;
    // A part-paid first cycle owes its balance within 7 days, whatever the cycle length. The cycle itself
    // (its period, and every later one) stays anchored to the move-in date, so settling the balance late
    // never shifts the tenant's billing day. A fully paid first cycle is covered until the cycle's due date.
    const dueMs = partial ? startOfDay(Date.now()) + 7 * DAY_MS : cycleDueMs;
    const chargeId = await ensureRentCharge(propertyId, ownerUid, { tenantUid: input.residentId, period: periodOf(cycleDueMs), amountInr: input.rentInr, dueMs });
    await recordPayment(propertyId, ownerUid, {
      // Fixed per tenant, so a retry never records the move-in payment twice.
      paymentId: `${input.residentId}_movein`,
      chargeId,
      tenantUid: input.residentId,
      amountInr: input.collect.amountInr,
      method: input.collect.method,
      paidMs: startOfDay(Date.now()),
      reference: input.collect.reference,
      note: partial ? 'Part payment collected at move-in' : 'Collected at move-in',
    });
    return { rentRecorded: true };
  } catch {
    return { rentRecorded: false };
  }
}

/**
 * Adds a tenant and gives them a bed. The resident and the bed claim (`bedAllocations/{bedId}`) are
 * written in ONE batch, so there is never a resident without a bed or the reverse. The claim is
 * create-only with the bed id as its id, so if another save claims the bed first this batch is
 * rejected by the rules. Availability is re-read first for a clear message; the rules are the real
 * guard. If a save fails after possibly succeeding (timeout), the bed claim is looked up before
 * reporting failure.
 */
async function addResident(propertyId: string, ownerUid: string, input: ResidentInput): Promise<void> {
  const db = getFirestoreDb();
  const bedRef = doc(db, 'properties', propertyId, 'rooms', input.roomId, 'beds', input.bedId);
  const heldBy = async () => (await fetchBedOccupants(propertyId, ownerUid)).get(input.bedId);

  try {
    const existing = await heldBy();
    if (existing !== undefined) {
      if (existing === input.name) return; // an earlier attempt of this same save went through
      throw new BedUnavailableError();
    }
    const bed = await getDoc(bedRef);
    if (!bed.exists() || bed.data().status !== 'available') throw new BedUnavailableError();
  } catch (error) {
    if (error instanceof BedUnavailableError) throw error;
    throw toRequestError(error);
  }

  const residentRef = doc(db, 'properties', propertyId, 'residents', input.residentId);
  const allocationRef = doc(db, 'properties', propertyId, 'bedAllocations', input.bedId);
  const batch = writeBatch(db);
  batch.set(residentRef, {
    ownerUid,
    propertyId,
    roomId: input.roomId,
    bedId: input.bedId,
    roomNumber: input.roomNumber,
    bedLabel: input.bedLabel,
    sharing: input.sharing,
    name: input.name,
    gender: input.gender,
    phoneCountry: '+91',
    phone: input.phone,
    ...(input.email ? { email: input.email } : {}),
    ...(input.address ? { address: input.address } : {}),
    ...(input.emergencyName && input.emergencyPhone
      ? { emergencyName: input.emergencyName, emergencyPhone: input.emergencyPhone }
      : {}),
    ...(input.link ? { tenantUid: input.link.tenantUid } : {}),
    rentInr: input.rentInr,
    ...(input.depositInr !== null ? { depositInr: input.depositInr } : {}),
    moveInDate: Timestamp.fromMillis(input.moveInMs),
    status: 'active',
    createdAt: serverTimestamp(),
  });
  batch.set(allocationRef, {
    ownerUid,
    propertyId,
    roomId: input.roomId,
    bedId: input.bedId,
    residentId: input.residentId,
    residentName: input.name,
    createdAt: serverTimestamp(),
  });
  if (input.link) {
    const { tenantUid, tenantName } = input.link;
    // Approve the request and make the tenant a member (checked in from their move-in date), together
    // with the resident and the bed claim above: all of it succeeds or none of it does.
    batch.update(doc(db, 'properties', propertyId, 'stayRequests', tenantUid), { status: 'approved', updatedAt: serverTimestamp() });
    batch.set(doc(db, 'properties', propertyId, 'members', tenantUid), {
      tenantUid,
      propertyId,
      ownerUid,
      displayName: tenantName,
      status: 'active',
      source: 'stay-request',
      checkInAt: Timestamp.fromMillis(input.moveInMs),
      joinedAt: serverTimestamp(),
    });
  }
  try {
    await batch.commit();
  } catch (error) {
    try {
      if ((await heldBy()) === input.name) return;
    } catch {
      // Fall through to the original error.
    }
    throw toRequestError(error);
  }
}

/** Everything stored on a resident the owner added (the Tenant Details screen reads it). */
export type ResidentDetail = {
  gender: Gender | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  depositInr: number | null;
  roomId: string | null;
  bedId: string | null;
  moveInMs: number | null;
  /** The monthly rent of the bed, fixed when the bed was assigned. */
  rentInr: number | null;
};

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/**
 * One resident document. A resident of another owner or property is refused by the rules and also
 * checked here (owner and property must match), so a mismatching document reads as not found.
 */
export async function fetchResidentDetail(propertyId: string, residentId: string, ownerUid: string): Promise<ResidentDetail | null> {
  try {
    const snap = await getDoc(doc(getFirestoreDb(), 'properties', propertyId, 'residents', residentId));
    if (!snap.exists()) return null;
    const d = snap.data() as Record<string, unknown>;
    if (d.ownerUid !== ownerUid || d.propertyId !== propertyId) return null;
    const moved = d.moveInDate as { toMillis?: () => number } | undefined;
    return {
      gender: isGender(d.gender) ? d.gender : null,
      phone: str(d.phone),
      email: str(d.email),
      address: str(d.address),
      emergencyName: str(d.emergencyName),
      emergencyPhone: str(d.emergencyPhone),
      depositInr: typeof d.depositInr === 'number' ? d.depositInr : null,
      roomId: str(d.roomId),
      bedId: str(d.bedId),
      moveInMs: typeof moved?.toMillis === 'function' ? moved.toMillis() : null,
      rentInr: typeof d.rentInr === 'number' && d.rentInr > 0 ? d.rentInr : null,
    };
  } catch (error) {
    throw toRequestError(error);
  }
}

/**
 * Saves the contact fields of an added tenant (and nothing else). The name is also kept on the bed
 * claim, so a changed name updates both documents in one batch. A cleared optional field is removed.
 * Rejected by the rules if it touches anything but these fields, or another owner's tenant.
 */
export async function updateResident(
  propertyId: string,
  residentId: string,
  bedId: string,
  nameChanged: boolean,
  edit: ResidentEdit,
): Promise<void> {
  const db = getFirestoreDb();
  const batch = writeBatch(db);
  batch.update(doc(db, 'properties', propertyId, 'residents', residentId), {
    name: edit.name,
    phone: edit.phone,
    email: edit.email ?? deleteField(),
    address: edit.address ?? deleteField(),
    emergencyName: edit.emergencyName ?? deleteField(),
    emergencyPhone: edit.emergencyPhone ?? deleteField(),
    updatedAt: serverTimestamp(),
  });
  if (nameChanged) {
    batch.update(doc(db, 'properties', propertyId, 'bedAllocations', bedId), { residentName: edit.name });
  }
  try {
    await batch.commit();
  } catch (error) {
    throw toRequestError(error);
  }
}
