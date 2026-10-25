import { addMonths, canRequestMoveOut, cleanPolicy, DEFAULT_POLICY, moveOutOptions, parsePolicy, policySummary, samePolicy } from '@/features/moveOut/moveOutModel';

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 10).getTime();

describe('move-out policy', () => {
  it('falls back to the default for a missing or malformed policy', () => {
    expect(parsePolicy(undefined)).toEqual(DEFAULT_POLICY);
    expect(parsePolicy({ instant: 'yes', noticeMonths: [1] })).toEqual(DEFAULT_POLICY);
    expect(parsePolicy({ instant: false })).toEqual(DEFAULT_POLICY);
  });
  it('keeps only offered notice periods, once, in order', () => {
    expect(parsePolicy({ instant: false, noticeMonths: [3, 1, 1, 5, 'x', 6] })).toEqual({ instant: false, noticeMonths: [1, 3, 6] });
    expect(cleanPolicy({ instant: true, noticeMonths: [] })).toEqual({ instant: true, noticeMonths: [] });
  });
  it('compares policies and summarises them', () => {
    expect(samePolicy(DEFAULT_POLICY, { instant: true, noticeMonths: [1, 2, 3] })).toBe(true);
    expect(samePolicy(DEFAULT_POLICY, { instant: false, noticeMonths: [1, 2, 3] })).toBe(false);
    expect(policySummary({ instant: true, noticeMonths: [1, 3] })).toBe('immediate move-out · 1 month notice · 3 months notice');
    expect(policySummary({ instant: false, noticeMonths: [] })).toBe('No move-out options are offered');
  });
});

describe('move-out options', () => {
  it('adds months on the same day, clamped to the month end', () => {
    expect(new Date(addMonths(at(2026, 1, 15), 2)).getMonth()).toBe(2);
    expect(new Date(addMonths(at(2026, 1, 15), 2)).getDate()).toBe(15);
    const clamped = new Date(addMonths(at(2026, 1, 31), 1));
    expect([clamped.getMonth(), clamped.getDate()]).toEqual([1, 28]);
    expect(new Date(addMonths(at(2026, 11, 20), 3)).getFullYear()).toBe(2027);
  });
  it('offers exactly what the policy allows, with dates', () => {
    const now = at(2026, 3, 10);
    const all = moveOutOptions({ instant: true, noticeMonths: [1, 3] }, now);
    expect(all.map((o) => o.id)).toEqual(['instant', 'notice-1', 'notice-3']);
    expect(all[0].dateMs).toBe(now);
    expect(all[1].label).toBe('Move out after 1 month');
    expect(all[2].label).toBe('Move out after 3 months');
    expect(moveOutOptions({ instant: false, noticeMonths: [2] }, now).map((o) => o.id)).toEqual(['notice-2']);
    expect(moveOutOptions({ instant: false, noticeMonths: [] }, now)).toEqual([]);
  });
  it('lets a tenant ask again only after a declined or withdrawn request', () => {
    expect(canRequestMoveOut(null)).toBe(true);
    expect(canRequestMoveOut({ status: 'rejected' })).toBe(true);
    expect(canRequestMoveOut({ status: 'withdrawn' })).toBe(true);
    expect(canRequestMoveOut({ status: 'pending' })).toBe(false);
    expect(canRequestMoveOut({ status: 'approved' })).toBe(false);
  });
});
