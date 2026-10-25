// Pure model of property reviews. No React, no Firebase.
//
// Firestore shape (see firestore.rules):
//   properties/{pid}/reviews/{tenantUid}   tenantUid, propertyId, tenantName, rating (1-5), comment?,
//                                          createdAt, updatedAt
// The document id is the reviewer's uid, so a resident has at most one review per property, which
// they can edit or delete. Only someone with a membership at the property can write one.

export type Review = {
  /** The reviewer's uid. */
  id: string;
  tenantName: string;
  rating: number;
  comment: string | null;
  createdMs: number | null;
};

export type ReviewSummary = { count: number; average: number | null };

export const COMMENT_MAX = 500;
export const REVIEW_PAGE_SIZE = 10;

export type ReviewInput = { rating: number; comment: string };
export type ReviewErrors = { rating?: string; comment?: string };

export function validateReview(input: ReviewInput): ReviewErrors {
  const errors: ReviewErrors = {};
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) errors.rating = 'Choose a rating from 1 to 5 stars.';
  if (input.comment.trim().length > COMMENT_MAX) errors.comment = `Keep your review under ${COMMENT_MAX} characters.`;
  return errors;
}

/** "Aarav S." from "Aarav Sharma": the first name and the initial of the last, so full names are not shown. */
export function reviewerLabel(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'A resident';
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

/** "4.3" (one decimal), or null when there are no reviews. */
export const formatAverage = (average: number | null): string | null => (average === null ? null : average.toFixed(1));

export const countLabel = (count: number): string => `${count} ${count === 1 ? 'review' : 'reviews'}`;

/** How many of 5 stars are filled for an average, rounded to the nearest whole star. */
export const filledStars = (rating: number | null): number => (rating === null ? 0 : Math.max(0, Math.min(5, Math.round(rating))));

/** Reviews newest first (a review whose server time has not arrived yet is the newest). */
export const sortReviews = (items: readonly Review[]): Review[] =>
  [...items].sort((a, b) => (b.createdMs ?? Number.MAX_SAFE_INTEGER) - (a.createdMs ?? Number.MAX_SAFE_INTEGER));

/** Pages concatenated without a review appearing twice. */
export function mergeReviewPages(pages: readonly { items: readonly Review[] }[]): Review[] {
  const seen = new Set<string>();
  return pages.flatMap((p) => p.items).filter((r) => !seen.has(r.id) && !!seen.add(r.id));
}

/** How long after leaving a resident can still add or change a review. */
export const REVIEW_WINDOW_DAYS = 30;
const DAY_MS = 86_400_000;

/**
 * Whether a resident may add or change a review now: `open` while they stay and for 30 days after
 * their check-out date; `expired` after that (or once the membership is inactive with no check-out
 * date to measure from); `none` when they were never a resident. The Firestore rules decide with
 * the server clock; this only decides what to show.
 */
export type ReviewEligibility = 'open' | 'expired' | 'none';

export function reviewEligibility(member: { status: string; checkOutMs: number | null } | null, nowMs: number): ReviewEligibility {
  if (member === null) return 'none';
  if (member.checkOutMs !== null) return nowMs <= member.checkOutMs + REVIEW_WINDOW_DAYS * DAY_MS ? 'open' : 'expired';
  return member.status === 'active' ? 'open' : 'expired';
}

export const EXPIRED_MESSAGE = `Reviews can only be added or changed while you stay and for ${REVIEW_WINDOW_DAYS} days after you leave. That time has passed.`;
