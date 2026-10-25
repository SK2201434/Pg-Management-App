import {
  average,
  collection,
  count,
  deleteDoc,
  doc,
  getAggregateFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';

import { getFirestoreDb } from '@/config/firebase';
import { REVIEW_PAGE_SIZE, type Review, type ReviewInput, type ReviewSummary } from '@/features/reviews/reviewsModel';

const reviewsOf = (propertyId: string) => collection(getFirestoreDb(), 'properties', propertyId, 'reviews');
const reviewRef = (propertyId: string, uid: string) => doc(getFirestoreDb(), 'properties', propertyId, 'reviews', uid);

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const millis = (v: unknown): number | null => (typeof (v as { toMillis?: unknown } | null)?.toMillis === 'function' ? (v as { toMillis: () => number }).toMillis() : null);

function toReview(id: string, data: Record<string, unknown>): Review | null {
  const rating = data.rating;
  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) return null;
  return { id, tenantName: text(data.tenantName) ?? 'A resident', rating, comment: text(data.comment), createdMs: millis(data.createdAt) };
}

/** The exact count and average over ALL reviews, computed by Firestore (not from the loaded page). */
export async function fetchReviewSummary(propertyId: string): Promise<ReviewSummary> {
  const snap = await getAggregateFromServer(query(reviewsOf(propertyId)), { count: count(), avg: average('rating') });
  const { count: total, avg } = snap.data();
  return { count: total, average: total > 0 && typeof avg === 'number' ? avg : null };
}

export type ReviewsPage = { items: Review[]; nextCursor: number | null };

/** One page of reviews, newest first; the cursor is the last review's creation time. */
export async function fetchReviewsPage(propertyId: string, cursor: number | null): Promise<ReviewsPage> {
  const snap = await getDocs(
    query(reviewsOf(propertyId), orderBy('createdAt', 'desc'), ...(cursor !== null ? [startAfter(Timestamp.fromMillis(cursor))] : []), limit(REVIEW_PAGE_SIZE + 1)),
  );
  const docs = snap.docs.slice(0, REVIEW_PAGE_SIZE);
  const items = docs.flatMap((d) => {
    const r = toReview(d.id, d.data());
    return r ? [r] : [];
  });
  const last = docs.length > 0 ? millis(docs[docs.length - 1].data().createdAt) : null;
  return { items, nextCursor: snap.size > REVIEW_PAGE_SIZE ? last : null };
}

/** The signed-in resident's own review of the property, if any. */
export async function fetchMyReview(propertyId: string, uid: string): Promise<Review | null> {
  const snap = await getDoc(reviewRef(propertyId, uid));
  return snap.exists() ? toReview(snap.id, snap.data()) : null;
}

/** The user's membership at the property (status and check-out date), or null if they never joined. */
export async function fetchMembership(propertyId: string, uid: string): Promise<{ status: string; checkOutMs: number | null } | null> {
  const snap = await getDoc(doc(getFirestoreDb(), 'properties', propertyId, 'members', uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  return { status: typeof data.status === 'string' ? data.status : 'inactive', checkOutMs: millis(data.checkOutAt) };
}

/** Creates the review, or updates the rating and comment of an existing one. */
export async function saveReview(args: { propertyId: string; uid: string; tenantName: string; input: ReviewInput; existing: boolean }): Promise<void> {
  const { propertyId, uid, tenantName, input, existing } = args;
  const comment = input.comment.trim();
  if (existing) {
    await updateDoc(reviewRef(propertyId, uid), { rating: input.rating, comment: comment || null, updatedAt: serverTimestamp() });
    return;
  }
  await setDoc(reviewRef(propertyId, uid), {
    tenantUid: uid,
    propertyId,
    tenantName,
    rating: input.rating,
    ...(comment ? { comment } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteReview(propertyId: string, uid: string): Promise<void> {
  await deleteDoc(reviewRef(propertyId, uid));
}
