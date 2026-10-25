import { collection, doc, getDocs, query, serverTimestamp, setDoc, Timestamp, where } from 'firebase/firestore';

import { getFirestoreDb } from '@/config/firebase';
import { reminderDocId, type MyRentReminder, type RentReminder } from '@/features/rent/reminderModel';

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const millis = (v: unknown): number | null => (typeof (v as { toMillis?: unknown } | null)?.toMillis === 'function' ? (v as { toMillis: () => number }).toMillis() : null);

/** Raised when a reminder for this tenant and month was already sent today. */
export class AlreadyRemindedError extends Error {
  constructor() {
    super('A reminder for this month was already sent today.');
    this.name = 'AlreadyRemindedError';
  }
}

/**
 * Sends the in-app reminder: one record the tenant's app turns into a notification. The id is per
 * tenant, month and day and the rules only allow creating it, so repeating it the same day is
 * refused rather than sent twice.
 */
export async function sendRentReminder(args: { propertyId: string; ownerUid: string; tenantUid: string; reminder: RentReminder; nowMs: number }): Promise<void> {
  const { propertyId, ownerUid, tenantUid, reminder, nowMs } = args;
  try {
    await setDoc(doc(getFirestoreDb(), 'properties', propertyId, 'rentReminders', reminderDocId(tenantUid, reminder.period, nowMs)), {
      ownerUid,
      tenantUid,
      propertyId,
      period: reminder.period,
      amountInr: reminder.amountInr,
      totalInr: reminder.totalInr,
      dueAt: Timestamp.fromMillis(reminder.dueMs),
      message: reminder.message,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    // Creating over an existing record is an update, which the rules deny.
    if ((error as { code?: string } | null)?.code?.endsWith('permission-denied')) throw new AlreadyRemindedError();
    throw error;
  }
}

/** The reminders sent to the signed-in tenant for their property, newest first. */
export async function fetchMyRentReminders(propertyId: string, tenantUid: string): Promise<MyRentReminder[]> {
  const snap = await getDocs(query(collection(getFirestoreDb(), 'properties', propertyId, 'rentReminders'), where('tenantUid', '==', tenantUid)));
  return snap.docs
    .flatMap((d): MyRentReminder[] => {
      const data = d.data();
      const message = text(data.message);
      const period = text(data.period);
      if (message === null || period === null || typeof data.amountInr !== 'number') return [];
      return [{ id: d.id, propertyId, period, amountInr: data.amountInr, message, createdMs: millis(data.createdAt) }];
    })
    .sort((a, b) => (b.createdMs ?? Number.MAX_SAFE_INTEGER) - (a.createdMs ?? Number.MAX_SAFE_INTEGER));
}
