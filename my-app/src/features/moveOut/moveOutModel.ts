// Pure model of moving out. No React, no Firebase.
//
// Firestore shape (see firestore.rules):
//   properties/{pid}.moveOutPolicy                   { instant: boolean, noticeMonths: number[] }  set by the owner
//   properties/{pid}/moveOutRequests/{tenantUid}     one request per tenant per property: tenantUid, ownerUid,
//                                                    propertyId, tenantName, kind ('instant' | 'notice'), months?,
//                                                    moveOutAt, status, createdAt, updatedAt
// Approving a request sets `checkOutAt` on the tenant's membership to `moveOutAt`.

export type MoveOutPolicy = { instant: boolean; noticeMonths: number[] };

/** Notice periods an owner can offer, in months. */
export const NOTICE_CHOICES = [1, 2, 3, 6] as const;

/** What a property offers until its owner sets something: moving out now, or after 1, 2 or 3 months. */
export const DEFAULT_POLICY: MoveOutPolicy = { instant: true, noticeMonths: [1, 2, 3] };

/** The stored policy, defensively; anything missing or malformed falls back to the default. */
export function parsePolicy(value: unknown): MoveOutPolicy {
  const v = value as { instant?: unknown; noticeMonths?: unknown } | null | undefined;
  if (!v || typeof v.instant !== 'boolean' || !Array.isArray(v.noticeMonths)) return DEFAULT_POLICY;
  return cleanPolicy({ instant: v.instant, noticeMonths: v.noticeMonths.filter((n): n is number => typeof n === 'number') });
}

/** Keeps only the offered notice periods, once each, in ascending order. */
export function cleanPolicy(policy: MoveOutPolicy): MoveOutPolicy {
  const months = NOTICE_CHOICES.filter((m) => policy.noticeMonths.includes(m));
  return { instant: policy.instant, noticeMonths: [...months] };
}

export const samePolicy = (a: MoveOutPolicy, b: MoveOutPolicy): boolean =>
  a.instant === b.instant && a.noticeMonths.length === b.noticeMonths.length && a.noticeMonths.every((m, i) => m === b.noticeMonths[i]);

/** The same day-of-month `n` months later, clamped to the month's last day (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(ms: number, n: number): number {
  const d = new Date(ms);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d.getTime();
}

export type MoveOutOption = { id: string; kind: 'instant' | 'notice'; months: number | null; label: string; dateMs: number };

/** What the tenant may choose, with the move-out date each choice means. Nothing when the policy allows nothing. */
export function moveOutOptions(policy: MoveOutPolicy, nowMs: number): MoveOutOption[] {
  const options: MoveOutOption[] = [];
  if (policy.instant) options.push({ id: 'instant', kind: 'instant', months: null, label: 'Move out now', dateMs: nowMs });
  for (const m of policy.noticeMonths) {
    options.push({ id: `notice-${m}`, kind: 'notice', months: m, label: `Move out after ${m} ${m === 1 ? 'month' : 'months'}`, dateMs: addMonths(nowMs, m) });
  }
  return options;
}

export const policySummary = (policy: MoveOutPolicy): string => {
  const parts = [
    ...(policy.instant ? ['immediate move-out'] : []),
    ...policy.noticeMonths.map((m) => `${m} ${m === 1 ? 'month' : 'months'} notice`),
  ];
  return parts.length === 0 ? 'No move-out options are offered' : parts.join(' · ');
};

export type MoveOutStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';
export const MOVE_OUT_STATUSES: readonly MoveOutStatus[] = ['pending', 'approved', 'rejected', 'withdrawn'];

export type MoveOutRequest = {
  propertyId: string;
  tenantUid: string;
  tenantName: string;
  kind: 'instant' | 'notice';
  months: number | null;
  moveOutMs: number;
  status: MoveOutStatus;
  createdMs: number | null;
  updatedMs: number | null;
};

export const MOVE_OUT_LABEL: Record<MoveOutStatus, string> = {
  pending: 'Move-out requested',
  approved: 'Move-out approved',
  rejected: 'Move-out declined',
  withdrawn: 'Move-out withdrawn',
};

export const formatMoveOutDate = (ms: number): string => new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** A tenant may ask when no request is open or approved (a declined or withdrawn one may be sent again). */
export const canRequestMoveOut = (existing: Pick<MoveOutRequest, 'status'> | null): boolean => existing === null || existing.status === 'rejected' || existing.status === 'withdrawn';
