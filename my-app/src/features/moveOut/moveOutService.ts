import { collection, deleteField, doc, getDoc, getDocs, query, serverTimestamp, Timestamp, updateDoc, where, writeBatch, setDoc } from 'firebase/firestore';

import { getFirestoreDb } from '@/config/firebase';
import { classifyLoadError } from '@/features/discovery/loadError';
import { MOVE_OUT_STATUSES, type MoveOutOption, type MoveOutRequest } from '@/features/moveOut/moveOutModel';

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const millis = (v: unknown): number | null => (typeof (v as { toMillis?: unknown } | null)?.toMillis === 'function' ? (v as { toMillis: () => number }).toMillis() : null);

const requestRef = (propertyId: string, tenantUid: string) => doc(getFirestoreDb(), 'properties', propertyId, 'moveOutRequests', tenantUid);

function toRequest(propertyId: string, tenantUid: string, data: Record<string, unknown>): MoveOutRequest | null {
  const moveOutMs = millis(data.moveOutAt);
  const status = MOVE_OUT_STATUSES.find((s) => s === data.status);
  if (moveOutMs === null || !status || (data.kind !== 'instant' && data.kind !== 'notice')) return null;
  return {
    propertyId,
    tenantUid,
    tenantName: text(data.tenantName) ?? 'Tenant',
    kind: data.kind,
    months: typeof data.months === 'number' ? data.months : null,
    moveOutMs,
    status,
    createdMs: millis(data.createdAt),
    updatedMs: millis(data.updatedAt),
  };
}

/** The tenant's own move-out request for a property, if any (the document id is their uid). */
export async function fetchMyMoveOutRequest(propertyId: string, tenantUid: string): Promise<MoveOutRequest | null> {
  let snap;
  try {
    snap = await getDoc(requestRef(propertyId, tenantUid));
  } catch (error) {
    // The rules judge a request by its own fields, so reading one that does not exist is denied:
    // for the tenant's own id that means "no request yet".
    if (classifyLoadError(error) === 'permission-denied') return null;
    throw error;
  }
  return snap.exists() ? toRequest(propertyId, tenantUid, snap.data()) : null;
}

/** Sends a move-out request, or sends a declined or withdrawn one again with the new choice. */
export async function sendMoveOutRequest(args: { propertyId: string; tenantUid: string; ownerUid: string; tenantName: string; option: MoveOutOption; existing: MoveOutRequest | null }): Promise<void> {
  const { propertyId, tenantUid, ownerUid, tenantName, option, existing } = args;
  const ref = requestRef(propertyId, tenantUid);
  const fields = { kind: option.kind, moveOutAt: Timestamp.fromMillis(option.dateMs), status: 'pending', updatedAt: serverTimestamp() };
  if (existing) {
    await updateDoc(ref, { ...fields, tenantName, months: option.months ?? deleteField() });
    return;
  }
  await setDoc(ref, { ...fields, tenantUid, ownerUid, propertyId, tenantName, ...(option.months !== null ? { months: option.months } : {}), createdAt: serverTimestamp() });
}

export async function withdrawMoveOutRequest(propertyId: string, tenantUid: string): Promise<void> {
  await updateDoc(requestRef(propertyId, tenantUid), { status: 'withdrawn', updatedAt: serverTimestamp() });
}

export type OwnerMoveOutRequest = MoveOutRequest & { propertyName: string };

/** The owner's move-out requests across their properties (one filtered query per property). */
export async function fetchOwnerMoveOutRequests(ownerUid: string, properties: readonly { id: string; name: string }[]): Promise<OwnerMoveOutRequest[]> {
  const db = getFirestoreDb();
  const perProperty = await Promise.all(
    properties.map(async (p) => {
      const snap = await getDocs(query(collection(db, 'properties', p.id, 'moveOutRequests'), where('ownerUid', '==', ownerUid)));
      return snap.docs.flatMap((d): OwnerMoveOutRequest[] => {
        const r = toRequest(p.id, d.id, d.data());
        return r ? [{ ...r, propertyName: p.name }] : [];
      });
    }),
  );
  return perProperty.flat();
}

/**
 * The owner's decision. Approving also records the move-out date as the tenant's check-out date, in
 * the same batch, so the request and the stay never disagree.
 */
export async function decideMoveOut(request: MoveOutRequest, status: 'approved' | 'rejected'): Promise<void> {
  const db = getFirestoreDb();
  const batch = writeBatch(db);
  batch.update(requestRef(request.propertyId, request.tenantUid), { status, updatedAt: serverTimestamp() });
  if (status === 'approved') {
    batch.update(doc(db, 'properties', request.propertyId, 'members', request.tenantUid), { checkOutAt: Timestamp.fromMillis(request.moveOutMs) });
  }
  await batch.commit();
}
