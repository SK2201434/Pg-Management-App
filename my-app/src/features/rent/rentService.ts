import { collection, doc, getDocs, query, serverTimestamp, setDoc, Timestamp, where } from 'firebase/firestore';

import { getFirestoreDb } from '@/config/firebase';
import { toRequestError } from '@/features/properties/propertyService';
import {
  chargeId as makeChargeId,
  type PaymentMethod,
  type RentCharge,
  type RentPayment,
} from '@/features/rent/rentModel';

/** A payment that cannot be recorded because of the current balance (checked against fresh data). */
export class PaymentRejectedError extends Error {
  constructor(
    readonly reason: 'charge-missing' | 'exceeds-balance',
    readonly remainingInr: number,
  ) {
    super(reason === 'charge-missing' ? 'This rent charge no longer exists.' : 'The amount is more than the balance.');
    this.name = 'PaymentRejectedError';
  }
}

const METHODS: readonly string[] = ['upi', 'cash', 'bank', 'cheque'];
const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const ms = (v: unknown): number | null => {
  const t = v as { toMillis?: () => number } | undefined;
  return typeof t?.toMillis === 'function' ? t.toMillis() : null;
};

// Rent data lives under the property (`properties/{pid}/rentCharges`, `.../payments`), so the path is
// the property scope. List queries must also filter on `ownerUid` (the rules require it), and each
// document is checked against `propertyId` again.

export async function fetchRentCharges(propertyId: string, ownerUid: string): Promise<RentCharge[]> {
  try {
    const snap = await getDocs(
      query(collection(getFirestoreDb(), 'properties', propertyId, 'rentCharges'), where('ownerUid', '==', ownerUid)),
    );
    const out: RentCharge[] = [];
    for (const d of snap.docs) {
      const data = d.data() as Record<string, unknown>;
      const dueMs = ms(data.dueDate);
      if (data.propertyId !== propertyId || typeof data.tenantUid !== 'string') continue;
      if (typeof data.period !== 'string' || typeof data.amountInr !== 'number' || dueMs === null) continue;
      out.push({ id: d.id, tenantUid: data.tenantUid, period: data.period, amountInr: data.amountInr, dueMs });
    }
    return out;
  } catch (error) {
    throw toRequestError(error);
  }
}

function toPayments(propertyId: string, docs: { id: string; data(): unknown }[]): RentPayment[] {
  const out: RentPayment[] = [];
  for (const d of docs) {
    const data = d.data() as Record<string, unknown>;
    const paidMs = ms(data.paidOn);
    if (data.propertyId !== propertyId || typeof data.tenantUid !== 'string' || typeof data.chargeId !== 'string') continue;
    if (typeof data.amountInr !== 'number' || typeof data.method !== 'string' || !METHODS.includes(data.method) || paidMs === null) continue;
    out.push({
      id: d.id,
      tenantUid: data.tenantUid,
      chargeId: data.chargeId,
      amountInr: data.amountInr,
      method: data.method as PaymentMethod,
      paidMs,
      reference: text(data.reference),
      note: text(data.note),
    });
  }
  return out;
}

export async function fetchPayments(propertyId: string, ownerUid: string): Promise<RentPayment[]> {
  try {
    const snap = await getDocs(
      query(collection(getFirestoreDb(), 'properties', propertyId, 'payments'), where('ownerUid', '==', ownerUid)),
    );
    return toPayments(propertyId, snap.docs);
  } catch (error) {
    throw toRequestError(error);
  }
}

/** The tenant must be a member of the property; the id `<tenantUid>_<period>` makes a second charge for the same month impossible. */
export async function createRentCharge(
  propertyId: string,
  ownerUid: string,
  input: { tenantUid: string; period: string; amountInr: number; dueMs: number },
): Promise<void> {
  try {
    await setDoc(doc(getFirestoreDb(), 'properties', propertyId, 'rentCharges', makeChargeId(input.tenantUid, input.period)), {
      ownerUid,
      propertyId,
      tenantUid: input.tenantUid,
      period: input.period,
      amountInr: input.amountInr,
      dueDate: Timestamp.fromMillis(input.dueMs),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    throw toRequestError(error);
  }
}

export type PaymentInput = {
  /** Fixed for one form, so a retry of the same payment can never record it twice. */
  paymentId: string;
  chargeId: string;
  tenantUid: string;
  amountInr: number;
  method: PaymentMethod;
  paidMs: number;
  reference: string | null;
  note: string | null;
};

/**
 * Records one payment against a charge of this property. The balance is re-read first (payments of
 * that charge are summed from Firestore), so a stale screen cannot overpay. Payments are immutable
 * and balances are derived, so there is no counter to drift. If the write fails after possibly
 * succeeding (e.g. a timeout), the payment id is looked up before reporting failure.
 */
export async function recordPayment(propertyId: string, ownerUid: string, input: PaymentInput): Promise<void> {
  const db = getFirestoreDb();
  const [charges, payments] = await Promise.all([
    fetchRentCharges(propertyId, ownerUid),
    fetchChargePayments(propertyId, ownerUid, input.chargeId),
  ]);
  if (payments.some((p) => p.id === input.paymentId)) return;
  const charge = charges.find((c) => c.id === input.chargeId && c.tenantUid === input.tenantUid);
  if (!charge) throw new PaymentRejectedError('charge-missing', 0);
  const remaining = charge.amountInr - payments.reduce((sum, p) => sum + p.amountInr, 0);
  if (input.amountInr > remaining) throw new PaymentRejectedError('exceeds-balance', Math.max(0, remaining));

  try {
    await setDoc(doc(db, 'properties', propertyId, 'payments', input.paymentId), {
      ownerUid,
      propertyId,
      tenantUid: input.tenantUid,
      chargeId: input.chargeId,
      amountInr: input.amountInr,
      method: input.method,
      paidOn: Timestamp.fromMillis(input.paidMs),
      ...(input.reference ? { reference: input.reference } : {}),
      ...(input.note ? { note: input.note } : {}),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    try {
      const after = await fetchChargePayments(propertyId, ownerUid, input.chargeId);
      if (after.some((p) => p.id === input.paymentId)) return;
    } catch {
      // Fall through to the original error.
    }
    throw toRequestError(error);
  }
}

async function fetchChargePayments(propertyId: string, ownerUid: string, chargeId: string): Promise<RentPayment[]> {
  try {
    const snap = await getDocs(
      query(
        collection(getFirestoreDb(), 'properties', propertyId, 'payments'),
        where('ownerUid', '==', ownerUid),
        where('chargeId', '==', chargeId),
      ),
    );
    return toPayments(propertyId, snap.docs);
  } catch (error) {
    throw toRequestError(error);
  }
}
