import { reviewEligibility, COMMENT_MAX, countLabel, filledStars, formatAverage, mergeReviewPages, reviewerLabel, sortReviews, validateReview, type Review } from '@/features/reviews/reviewsModel';

const r = (id: string, createdMs: number | null): Review => ({ id, tenantName: id, rating: 5, comment: null, createdMs });

describe('reviews model', () => {
  it('validates the rating and the comment length', () => {
    expect(validateReview({ rating: 4, comment: 'Clean rooms' })).toEqual({});
    expect(validateReview({ rating: 5, comment: '' })).toEqual({});
    expect(validateReview({ rating: 0, comment: '' }).rating).toBeDefined();
    expect(validateReview({ rating: 6, comment: '' }).rating).toBeDefined();
    expect(validateReview({ rating: 3.5, comment: '' }).rating).toBeDefined();
    expect(validateReview({ rating: 3, comment: 'x'.repeat(COMMENT_MAX + 1) }).comment).toBeDefined();
  });

  it('shows reviewers as first name and last initial', () => {
    expect(reviewerLabel('Aarav Sharma')).toBe('Aarav S.');
    expect(reviewerLabel('  priya   kumar singh ')).toBe('priya S.');
    expect(reviewerLabel('Madonna')).toBe('Madonna');
    expect(reviewerLabel(null)).toBe('A resident');
  });

  it('formats the summary', () => {
    expect(formatAverage(4.333)).toBe('4.3');
    expect(formatAverage(null)).toBeNull();
    expect(countLabel(1)).toBe('1 review');
    expect(countLabel(3)).toBe('3 reviews');
    expect(filledStars(4.5)).toBe(5);
    expect(filledStars(3.4)).toBe(3);
    expect(filledStars(null)).toBe(0);
  });

  it('sorts newest first and merges pages without duplicates', () => {
    expect(sortReviews([r('a', 1), r('b', 3), r('c', null)]).map((x) => x.id)).toEqual(['c', 'b', 'a']);
    expect(mergeReviewPages([{ items: [r('a', 3), r('b', 2)] }, { items: [r('b', 2), r('c', 1)] }]).map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('opens reviews while staying and for 30 days after check-out, then closes them', () => {
    const day = 86_400_000;
    const out = 1_000 * day;
    expect(reviewEligibility(null, out)).toBe('none');
    expect(reviewEligibility({ status: 'active', checkOutMs: null }, out)).toBe('open'); // still staying
    expect(reviewEligibility({ status: 'active', checkOutMs: out }, out - day)).toBe('open'); // check-out is ahead
    expect(reviewEligibility({ status: 'active', checkOutMs: out }, out + 30 * day)).toBe('open'); // last day
    expect(reviewEligibility({ status: 'active', checkOutMs: out }, out + 30 * day + 1)).toBe('expired');
    expect(reviewEligibility({ status: 'inactive', checkOutMs: null }, out)).toBe('expired'); // left, no date
    expect(reviewEligibility({ status: 'inactive', checkOutMs: out }, out + day)).toBe('open'); // left recently
  });
});
