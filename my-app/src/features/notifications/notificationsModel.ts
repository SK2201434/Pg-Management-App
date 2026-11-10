// Pure model of the owner's notifications. No React, no Firebase, no storage.
//
// Notifications are DERIVED from saved rent records, not stored: HOSTELL has no server to write
// notification documents when something happens (Firebase Spark plan, no Cloud Functions). Each
// notification has a stable id built from the thing it is about (the rent charge or the payment), so
// the same overdue charge is always the same notification and can never appear twice, however often
// the screen refreshes. Only the "read" marks are stored (see notificationService.ts).
//
// Tenant issues and join requests have no data model in the app yet, so they produce nothing.
import { rentRows, type PropertyData } from '@/features/dashboard/dashboardModel';
import type { RequestCategory, RequestStatus } from '@/features/requests/requestsModel';
import { formatInr, PAYMENT_METHODS, startOfDay } from '@/features/rent/rentModel';

export type NotificationKind = 'rent-overdue' | 'rent-due-today' | 'payment-recorded' | 'stay-request' | 'tenant-request' | 'review' | 'phone-match' | 'phone-declined';

/** A review of one of the owner's properties, as the owner's live listener sees it. */
export type OwnerReviewEvent = {
  /** The reviewer's uid. */
  id: string;
  propertyId: string;
  propertyName: string;
  tenantName: string;
  rating: number;
  comment: string | null;
  createdMs: number | null;
};

/** One notification per review, kept for good. The id carries the creation time, so a review deleted and written again is new. */
export function buildReviewNotifications(reviews: readonly OwnerReviewEvent[], nowMs: number): OwnerNotification[] {
  return reviews.map((r) => ({
    id: `review_${r.propertyId}_${r.id}_${r.createdMs ?? 'new'}`,
    kind: 'review' as const,
    title: 'New review',
    body: `${r.tenantName} rated ${r.propertyName} ${r.rating}/5${r.comment ? `: “${r.comment.length > 80 ? `${r.comment.slice(0, 80).trimEnd()}…` : r.comment}”` : '.'}`,
    propertyId: r.propertyId,
    propertyName: r.propertyName,
    tenantUid: r.id,
    atMs: r.createdMs ?? nowMs,
  }));
}

/** A tenant's maintenance request as the owner's live listener sees it. */
export type OwnerTenantRequest = {
  id: string;
  propertyId: string;
  propertyName: string;
  tenantUid: string;
  title: string;
  category: RequestCategory;
  description: string;
  status: RequestStatus;
  createdMs: number | null;
};

const REQUEST_TITLE: Record<RequestStatus, string> = { open: 'New tenant request', in_progress: 'Tenant request in progress', resolved: 'Tenant request resolved' };

/**
 * One notification per request, kept for good: moving the request along changes its title but not its
 * id, so it stays in the list and keeps its read mark. `names` maps tenant uids to names.
 */
export function buildTenantRequestNotifications(
  requests: readonly OwnerTenantRequest[],
  names: ReadonlyMap<string, string>,
  nowMs: number,
): OwnerNotification[] {
  return requests
    .map((r) => ({
      id: `tenant-request_${r.propertyId}_${r.id}`,
      kind: 'tenant-request' as const,
      title: REQUEST_TITLE[r.status],
      body: `${names.get(r.tenantUid) ?? 'A tenant'} raised “${r.title}”.`,
      propertyId: r.propertyId,
      propertyName: r.propertyName,
      tenantUid: r.tenantUid,
      requestId: r.id,
      atMs: r.createdMs ?? nowMs,
    }));
}

export type OwnerNotification = {
  /** Stable: `<kind>_<propertyId>_<chargeOrPaymentId>`. Also the id of its read mark. */
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  propertyId: string;
  propertyName: string;
  tenantUid: string;
  /** For `tenant-request`: the issue it is about. */
  requestId?: string;
  /** For `phone-match` and `phone-declined`: the resident the owner added. */
  residentId?: string;
  /** History the owner caused themselves (their own decision): listed, but never shown as unread. */
  autoRead?: boolean;
  /** When the event happened (the due date, or the payment date). Dates have no time of day. */
  atMs: number;
};

const DAY_MS = 86_400_000;
export const RECENT_PAYMENT_DAYS = 30;

const dateLabel = (ms: number) => new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Overdue and due-today rent, plus payments recorded in the last 30 days, newest first. `null` while
 * any property's rent data is not loaded, so a half-loaded list never looks complete.
 */
export function buildNotifications(list: readonly PropertyData[], nowMs: number): OwnerNotification[] | null {
  const rows = rentRows(list, nowMs);
  if (rows === null) return null;
  const today = startOfDay(nowMs);
  const out: OwnerNotification[] = [];

  for (const r of rows) {
    if (r.row.remainingInr <= 0) continue;
    const due = startOfDay(r.row.charge.dueMs);
    const common = { propertyId: r.propertyId, propertyName: r.propertyName, tenantUid: r.row.charge.tenantUid, atMs: due };
    if (r.row.status === 'overdue') {
      out.push({
        ...common,
        id: `rent-overdue_${r.propertyId}_${r.row.charge.id}`,
        kind: 'rent-overdue',
        title: 'Rent overdue',
        body: `${r.row.tenantName} owes ${formatInr(r.row.remainingInr)}, due ${dateLabel(due)} (${r.row.daysOverdue} ${r.row.daysOverdue === 1 ? 'day' : 'days'} late).`,
      });
    } else if (due === today) {
      out.push({
        ...common,
        id: `rent-due-today_${r.propertyId}_${r.row.charge.id}`,
        kind: 'rent-due-today',
        title: 'Rent due today',
        body: `${r.row.tenantName} has ${formatInr(r.row.remainingInr)} due today.`,
      });
    }
  }

  const since = today - RECENT_PAYMENT_DAYS * DAY_MS;
  for (const p of list) {
    const names = new Map((p.tenants ?? []).map((t) => [t.tenantUid, t.name]));
    for (const pay of p.payments ?? []) {
      if (pay.paidMs < since) continue;
      const method = PAYMENT_METHODS.find((m) => m.value === pay.method)?.label;
      out.push({
        id: `payment-recorded_${p.id}_${pay.id}`,
        kind: 'payment-recorded',
        title: 'Payment recorded',
        body: `${names.get(pay.tenantUid) ?? 'A tenant'} paid ${formatInr(pay.amountInr)}${method ? ` by ${method}` : ''}.`,
        propertyId: p.id,
        propertyName: p.name,
        tenantUid: pay.tenantUid,
        atMs: pay.paidMs,
      });
    }
  }

  return out.sort((a, b) => b.atMs - a.atMs || a.id.localeCompare(b.id));
}

export const unreadIds = (items: readonly OwnerNotification[], read: ReadonlySet<string>): string[] =>
  items.filter((n) => !read.has(n.id)).map((n) => n.id);

/** "Today", "Yesterday" or "12 Oct 2026"; event dates carry no time of day. */
export function formatWhen(ms: number | null, nowMs: number): string {
  if (ms === null) return '';
  const diffDays = Math.round((startOfDay(nowMs) - startOfDay(ms)) / DAY_MS);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return dateLabel(ms);
}

// ---- paging ----

/** How many notifications the list shows at first, and how many more each scroll to the end adds. */
export const NOTIFICATION_PAGE_SIZE = 15;

/**
 * How many to show after the next page is requested. It never exceeds `total`, and once everything is
 * shown it stays put, so scrolling to the end again changes nothing: the list has no more to give.
 */
export const nextVisibleCount = (shown: number, total: number, pageSize: number = NOTIFICATION_PAGE_SIZE): number =>
  Math.min(total, Math.max(shown, 0) + pageSize);

// ---- read marks kept on the device ----

const MAX_LOCAL_READS = 2000;

export function parseLocalReads(raw: string | null): string[] {
  if (raw === null) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/** Adds ids (newest last) and keeps the list from growing without bound. */
export const mergeLocalReads = (existing: readonly string[], add: readonly string[]): string[] =>
  [...new Set([...existing, ...add])].slice(-MAX_LOCAL_READS);
