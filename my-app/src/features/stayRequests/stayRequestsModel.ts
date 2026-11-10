// Pure model of stay requests as the OWNER sees them. No React, no Firebase.
//
// A tenant's request lives at `properties/{pid}/stayRequests/{tenantUid}` (see discoveryModel.ts).
// The owner's notifications are derived from the requests, like the rent notifications are derived
// from rent records. A request is ONE notification for good: its id is built from the request and when
// it was created, so approving, declining or withdrawing it changes the notification's title but never
// makes it disappear. A request that is sent again after being withdrawn or declined is a new one.
import type { OwnerNotification } from '@/features/notifications/notificationsModel';

export type OwnerStayRequestStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';

export type OwnerStayRequest = {
  propertyId: string;
  propertyName: string;
  tenantUid: string;
  tenantName: string;
  tenantPhone: string | null;
  /** From the tenant's own profile; null on requests sent before it was copied. */
  tenantGender: 'male' | 'female' | null;
  tenantEmail: string | null;
  message: string | null;
  status: OwnerStayRequestStatus;
  createdMs: number | null;
  updatedMs: number | null;
};

export const STATUS_TEXT: Record<OwnerStayRequestStatus, string> = {
  pending: 'Waiting for your decision',
  approved: 'Approved',
  rejected: 'Declined',
  withdrawn: 'Withdrawn by the tenant',
};

const SNIPPET = 80;

const snippet = (message: string): string => (message.length > SNIPPET ? `${message.slice(0, SNIPPET).trimEnd()}…` : message);

/** A pending request changed this long after it was created can only have been sent again. */
const RESEND_GAP_MS = 5_000;

const TITLE: Record<OwnerStayRequestStatus, string> = {
  pending: 'New stay request',
  approved: 'Stay request approved',
  rejected: 'Stay request declined',
  withdrawn: 'Stay request withdrawn',
};

/**
 * One notification per request, whatever its status, newest first. `nowMs` stands in while a server
 * time has not arrived. Decisions the owner made themselves (approved, declined) are marked `autoRead`,
 * so they stay in the list as history without raising an unread dot.
 */
export function buildStayRequestNotifications(requests: readonly OwnerStayRequest[], nowMs: number): OwnerNotification[] {
  return requests
    .map((r): OwnerNotification => {
      const atMs = r.updatedMs ?? r.createdMs ?? nowMs;
      const base = `stay-request_${r.propertyId}_${r.tenantUid}_${r.createdMs ?? 'new'}`;
      const resent = r.status === 'pending' && r.createdMs !== null && r.updatedMs !== null && r.updatedMs - r.createdMs > RESEND_GAP_MS;
      const body =
        r.status === 'pending'
          ? `${r.tenantName} wants to stay at ${r.propertyName}.${r.message ? ` “${snippet(r.message)}”` : ''}`
          : r.status === 'approved'
            ? `You approved ${r.tenantName}’s request to stay at ${r.propertyName}.`
            : r.status === 'rejected'
              ? `You declined ${r.tenantName}’s request to stay at ${r.propertyName}.`
              : `${r.tenantName} withdrew their request to stay at ${r.propertyName}.`;
      return {
        id: resent ? `${base}_${r.updatedMs}` : base,
        kind: 'stay-request',
        title: TITLE[r.status],
        body,
        propertyId: r.propertyId,
        propertyName: r.propertyName,
        tenantUid: r.tenantUid,
        atMs,
        ...(r.status === 'approved' || r.status === 'rejected' ? { autoRead: true } : {}),
      };
    })
    .sort((a, b) => b.atMs - a.atMs || a.id.localeCompare(b.id));
}

/** Pending first (newest first), then the decided ones. */
export function sortStayRequests(items: readonly OwnerStayRequest[]): OwnerStayRequest[] {
  const when = (r: OwnerStayRequest) => r.updatedMs ?? r.createdMs ?? Number.MAX_SAFE_INTEGER;
  return [...items].sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending') || when(b) - when(a));
}

export const pendingCount = (items: readonly OwnerStayRequest[]): number => items.filter((r) => r.status === 'pending').length;
