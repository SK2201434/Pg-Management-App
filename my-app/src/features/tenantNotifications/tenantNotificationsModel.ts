// Pure model of the tenant's notifications. No React, no Firebase.
//
// Like the owner's, they are DERIVED from saved records rather than stored (no server writes
// notification documents on the Spark plan): the tenant's own requests and the property's updates.
// Each id is built from the thing and, for requests, the status it reached, so the same event is
// never listed twice and a new status is a new notification. Only the tenant's read marks are stored.
// Rent alerts are not produced: tenants cannot read rent records and no owner-send flow exists.
import { stayLabel, type StayChange } from '@/features/stayChange/stayChangeModel';
import { monthName, type MyRentReminder } from '@/features/rent/reminderModel';
import { STATUS_LABEL, type TenantRequest } from '@/features/requests/requestsModel';
import type { TenantUpdate } from '@/features/tenantHome/updatesModel';

export type TenantNotificationKind =
  | 'request-open'
  | 'request-in-progress'
  | 'request-resolved'
  | 'announcement'
  | 'announcement-important'
  | 'stay-approved'
  | 'stay-declined'
  | 'rent-reminder'
  | 'stay-change'
  | 'stay-changed'
  | 'stay-confirmation';

export type TenantNotification = {
  id: string;
  kind: TenantNotificationKind;
  title: string;
  body: string;
  propertyId: string;
  propertyName: string;
  /** Milliseconds since epoch; `null` while a server timestamp has not arrived. */
  atMs: number | null;
  /** Where tapping it goes. */
  target: 'requests' | 'updates' | 'property' | 'stay';
};

export function buildTenantNotifications(args: {
  propertyId: string;
  propertyName: string;
  requests: readonly TenantRequest[];
  updates: readonly TenantUpdate[];
}): TenantNotification[] {
  const { propertyId, propertyName, requests, updates } = args;
  const out: TenantNotification[] = [];

  for (const r of requests) {
    // The tenant raised an `open` request themselves; they are told only when the owner updates it.
    if (r.status === 'open') continue;
    const kind = r.status === 'resolved' ? 'request-resolved' : r.status === 'in_progress' ? 'request-in-progress' : 'request-open';
    out.push({
      id: `req_${propertyId}_${r.id}_${r.status}`,
      kind,
      title: r.status === 'resolved' ? 'Request resolved' : r.status === 'in_progress' ? 'Request in progress' : 'Request received',
      body: `“${r.title}” is now ${STATUS_LABEL[r.status]}.`,
      propertyId,
      propertyName,
      atMs: r.updatedMs ?? r.createdMs,
      target: 'requests',
    });
  }

  for (const u of updates) {
    out.push({
      id: `upd_${propertyId}_${u.id}`,
      kind: u.category === 'important' ? 'announcement-important' : 'announcement',
      title: u.title,
      body: u.message,
      propertyId,
      propertyName,
      atMs: u.createdMs,
      target: 'updates',
    });
  }

  // Newest first; one whose server time has not arrived yet is the newest.
  return out.sort((a, b) => (b.atMs ?? Number.MAX_SAFE_INTEGER) - (a.atMs ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id));
}

/** One notification per rent reminder the owner sent. The id is the reminder's own id, so each is listed once. */
export function buildRentReminderNotifications(reminders: readonly MyRentReminder[], propertyName: string): TenantNotification[] {
  return reminders.map(
    (r): TenantNotification => ({
      id: `rent-reminder_${r.propertyId}_${r.id}`,
      kind: 'rent-reminder',
      title: `Rent reminder · ${monthName(r.period)}`,
      body: r.message,
      propertyId: r.propertyId,
      propertyName,
      atMs: r.createdMs,
      target: 'stay',
    }),
  );
}

/**
 * The owner's room-change proposal: one notification while it waits for the tenant's answer, and one
 * once it has been applied. A new proposal is a new notification (the id carries its creation time).
 */
export function buildStayChangeNotifications(change: StayChange | null, propertyName: string): TenantNotification[] {
  if (!change || (change.status !== 'pending' && change.status !== 'applied')) return [];
  const pending = change.status === 'pending';
  return [
    {
      id: `stay-change_${change.propertyId}_${change.status}_${change.createdMs ?? 'new'}`,
      kind: pending ? 'stay-change' : 'stay-changed',
      title: pending ? 'Room change proposed' : 'Your room was updated',
      body: pending
        ? `${propertyName} proposes moving you from ${stayLabel(change.fromRoomNumber, change.fromBedLabel)} to ${stayLabel(change.toRoomNumber, change.toBedLabel)}. Open My Stay to accept or decline.`
        : `You are now in ${stayLabel(change.toRoomNumber, change.toBedLabel)} at ${propertyName}.`,
      propertyId: change.propertyId,
      propertyName,
      atMs: change.updatedMs ?? change.createdMs,
      target: 'stay',
    },
  ];
}

/** A tenant's own request to stay at a property (see discoveryModel.ts), as kept live in the app. */
export type MyStayRequest = {
  propertyId: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  message: string | null;
  createdMs: number | null;
  updatedMs: number | null;
};

/**
 * One notification when the owner has decided a request: "approved" or "declined". The id carries the
 * decision and its time, so each decision is listed once. `names` maps property ids to names; a name
 * that is not known yet reads as "The owner".
 */
export function buildStayDecisionNotifications(requests: readonly MyStayRequest[], names: ReadonlyMap<string, string>): TenantNotification[] {
  return requests
    .filter((r) => r.status === 'approved' || r.status === 'rejected')
    .map((r): TenantNotification => {
      const propertyName = names.get(r.propertyId) ?? 'the property';
      const approved = r.status === 'approved';
      return {
        id: `stay-decision_${r.propertyId}_${r.status}_${r.updatedMs ?? r.createdMs ?? 'new'}`,
        kind: approved ? 'stay-approved' : 'stay-declined',
        title: approved ? 'Stay request approved' : 'Stay request declined',
        body: approved
          ? `The owner of ${propertyName} approved your request to stay. They will assign your bed and add you to the property.`
          : `The owner of ${propertyName} could not accept your request to stay.`,
        propertyId: r.propertyId,
        propertyName: names.get(r.propertyId) ?? '',
        atMs: r.updatedMs ?? r.createdMs,
        target: 'property',
      };
    });
}

/**
 * While an owner still has to confirm the tenant (a resident was added with their phone number), one
 * notice. It names no property, room or bed and disappears once the stay is confirmed. It has no time,
 * so it counts as newest.
 */
export function buildStayConfirmationNotifications(pending: boolean): TenantNotification[] {
  if (!pending) return [];
  return [
    {
      id: 'stay-confirmation_pending',
      kind: 'stay-confirmation',
      title: 'You’re already a tenant of a property',
      body: 'Your owner has been sent a notification. Your stay details will be shown here after they confirm. Please contact your owner to confirm.',
      propertyId: '',
      propertyName: '',
      atMs: null,
      target: 'stay',
    },
  ];
}

/** Newest change first; a request whose server time has not arrived yet counts as newest. */
export const sortMyStayRequests = <T extends MyStayRequest>(items: readonly T[]): T[] =>
  [...items].sort((a, b) => (b.updatedMs ?? b.createdMs ?? Number.MAX_SAFE_INTEGER) - (a.updatedMs ?? a.createdMs ?? Number.MAX_SAFE_INTEGER));
