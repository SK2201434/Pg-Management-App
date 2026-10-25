import { addDoc, collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';

import { getFirestoreDb } from '@/config/firebase';
import { isCategory, toStatus, type NewRequestInput, type RequestCategory, type RequestStatus, type TenantRequest } from '@/features/requests/requestsModel';

const text = (v: unknown): string => (typeof v === 'string' ? v : '');

const requestsOf = (propertyId: string) => collection(getFirestoreDb(), 'properties', propertyId, 'requests');

/**
 * The tenant's own requests at their property. The query is filtered by `tenantUid` on the server
 * (the rules also only allow reading one's own), then sorted in the app, which needs no index.
 */
export async function fetchTenantRequests(propertyId: string, tenantUid: string): Promise<TenantRequest[]> {
  const snap = await getDocs(query(requestsOf(propertyId), where('tenantUid', '==', tenantUid)));
  return snap.docs.map((d) => {
    const data = d.data();
    const ms = (v: unknown) => (typeof (v as { toMillis?: unknown } | null | undefined)?.toMillis === 'function' ? (v as { toMillis: () => number }).toMillis() : null);
    return {
      id: d.id,
      category: isCategory(data.category) ? data.category : ('other' as RequestCategory),
      title: text(data.title) || 'Request',
      description: text(data.description),
      status: toStatus(data.status),
      createdMs: ms(data.createdAt),
      updatedMs: ms(data.updatedAt),
    };
  });
}

/**
 * Creates a request, `open`, for the tenant's property. The rules, not this code, decide whether the
 * tenant really has an active membership there and whether `ownerUid` is the property's owner.
 */
export async function createTenantRequest(args: {
  propertyId: string;
  tenantUid: string;
  ownerUid: string;
  input: NewRequestInput & { category: RequestCategory };
}): Promise<void> {
  const { propertyId, tenantUid, ownerUid, input } = args;
  await addDoc(requestsOf(propertyId), {
    tenantUid,
    ownerUid,
    propertyId,
    category: input.category,
    title: input.title.trim(),
    description: input.description.trim(),
    status: 'open',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** The owner moves a request along. The rules allow only `status` and `updatedAt` to change, by the property's owner. */
export async function updateRequestStatus(propertyId: string, requestId: string, status: RequestStatus): Promise<void> {
  await updateDoc(doc(requestsOf(propertyId), requestId), { status, updatedAt: serverTimestamp() });
}
