// Pure model of stay requests as the OWNER sees them. No React, no Firebase.
//
// A tenant's request lives at `properties/{pid}/stayRequests/{tenantUid}` (see discoveryModel.ts).
// The owner's notifications are derived from the pending ones, like the rent notifications are
// derived from rent records: each has a stable id built from the request and its last change, so a
// request is one notification, and a request that was withdrawn and sent again is a new one.
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

/** One notification per pending request, newest first. `nowMs` stands in while a server time has not arrived. */
export function buildStayRequestNotifications(requests: readonly OwnerStayRequest[], nowMs: number): OwnerNotification[] {
  return requests
    .filter((r) => r.status === 'pending')
    .map((r) => {
      const atMs = r.updatedMs ?? r.createdMs ?? nowMs;
      return {
        id: `stay-request_${r.propertyId}_${r.tenantUid}_${r.updatedMs ?? r.createdMs ?? 'new'}`,
        kind: 'stay-request' as const,
        title: 'New stay request',
        body: `${r.tenantName} wants to stay at ${r.propertyName}.${r.message ? ` “${snippet(r.message)}”` : ''}`,
        propertyId: r.propertyId,
        propertyName: r.propertyName,
        tenantUid: r.tenantUid,
        atMs,
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
