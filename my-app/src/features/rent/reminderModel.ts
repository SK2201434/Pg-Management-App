// Pure model of rent reminders. No React, no Firebase.
//
// Firestore shape (see firestore.rules):
//   properties/{pid}/rentReminders/{id}   ownerUid, tenantUid (the tenant's account), propertyId, period (YYYY-MM),
//                                         amountInr (what is payable for that month), totalInr (all unpaid months),
//                                         dueAt, message, createdAt
// The id is built from the tenant, the month and the day, so a second reminder for the same month on the
// same day is refused instead of spamming the tenant. The tenant's notification is derived from the record.
import { startOfDay, type LedgerRow } from '@/features/rent/rentModel';
import { pickPayableCharge, totalOutstanding } from '@/features/tenants/tenantDetailsModel';

export type RentReminder = {
  period: string;
  monthLabel: string;
  amountInr: number;
  totalInr: number;
  unpaidMonths: number;
  dueMs: number;
  status: 'overdue' | 'due-today' | 'upcoming' | 'partial';
  message: string;
};

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const day = (ms: number) => new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** "March 2026" from "2026-03". */
export function monthName(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return Number.isFinite(y) && Number.isFinite(m) ? new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : period;
}

const firstName = (name: string): string => name.trim().split(/\s+/)[0] || 'there';

/** How many days before the due date the owner may start reminding. */
export const REMINDER_LEAD_DAYS = 7;

const DAY_MS = 86_400_000;

/** The tenant's own billing cycle: the bed's fixed monthly rent, due on the move-in day of each month. */
export type RentSchedule = { moveInMs: number; rentInr: number };

/** `ms` shifted by whole months, keeping the day of month (clamped to the month's last day: 31 Jan -> 28 Feb). */
function addMonths(ms: number, months: number): number {
  const d = new Date(ms);
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), last)).getTime();
}

export const periodOf = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * TEMPORARY, FOR TESTING: rent is due the day after joining, then on that day each month. Set to
 * `false` to go back to the real cycle (due on the move-in day, one month after joining).
 */
export const DUE_NEXT_DAY_AFTER_JOINING_FOR_TESTING = false;

/**
 * The next rent due date that has not passed: the move-in day, one month on, then the month after.
 * A tenant who moved in on 22 Oct first pays by 22 Nov. (While the testing switch above is on, the
 * first due date is 23 Oct instead.)
 */
export function nextDueMs(moveInMs: number, nowMs: number): number {
  const today = startOfDay(nowMs);
  const test = DUE_NEXT_DAY_AFTER_JOINING_FOR_TESTING;
  const anchor = test ? startOfDay(startOfDay(moveInMs) + 1.5 * DAY_MS) : startOfDay(moveInMs);
  let k = test ? 0 : 1;
  while (addMonths(anchor, k) < today) k += 1;
  return addMonths(anchor, k);
}

/**
 * Every rent due date of a tenant's cycle from `fromMs` to `toMs` (both inclusive), oldest first. It is
 * the same cycle as `nextDueMs`, so the dates agree with the next due date the app already shows.
 */
export function dueDatesBetween(moveInMs: number, fromMs: number, toMs: number): number[] {
  const test = DUE_NEXT_DAY_AFTER_JOINING_FOR_TESTING;
  const anchor = test ? startOfDay(startOfDay(moveInMs) + 1.5 * DAY_MS) : startOfDay(moveInMs);
  const out: number[] = [];
  // Bounded, so a bad date can never loop for long.
  for (let k = test ? 0 : 1; k < 600; k += 1) {
    const due = addMonths(anchor, k);
    if (due > toMs) break;
    if (due >= fromMs) out.push(due);
  }
  return out;
}

/** The first day the owner may remind about a due date: a week before it. */
export const reminderOpensMs = (dueMs: number): number => startOfDay(dueMs) - REMINDER_LEAD_DAYS * DAY_MS;

/**
 * When the owner's next reminder becomes available, or null when it is already (or nothing is left to
 * remind about). Used to explain a disabled Remind button.
 */
export function nextReminderOpensMs(args: { rows: readonly LedgerRow[]; schedule: RentSchedule | null; nowMs: number }): number | null {
  const { rows, schedule, nowMs } = args;
  if (!schedule) return null;
  const today = startOfDay(nowMs);
  const dueMs = nextDueMs(schedule.moveInMs, nowMs);
  const opens = reminderOpensMs(dueMs);
  const settled = rows.some((r) => r.charge.period === periodOf(dueMs) && r.remainingInr <= 0);
  return opens > today && !settled ? opens : null;
}

/**
 * The reminder for a tenant's most urgent unpaid month, with the amount still payable for it, in a
 * polite, professional wording. Null when nothing is unpaid, or when the only thing left is a month
 * that is more than a week away. With a `schedule` (the bed's rent and the move-in day), the coming
 * month is reminded about even though its charge has not been recorded yet.
 */
export function buildRentReminder(args: {
  tenantName: string;
  propertyName: string;
  rows: readonly LedgerRow[];
  nowMs: number;
  schedule?: RentSchedule | null;
}): RentReminder | null {
  const { tenantName, propertyName, rows: allRows, nowMs, schedule } = args;
  const today = startOfDay(nowMs);
  // A charge that is not due for more than a week is not reminded about yet.
  const rows = allRows.filter((r) => startOfDay(r.charge.dueMs) - today <= REMINDER_LEAD_DAYS * DAY_MS);
  const recorded = pickPayableCharge(rows);
  if (recorded) return reminderFor({ tenantName, propertyName, rows: allRows, row: recorded, nowMs });
  if (!schedule) return null;

  // Nothing recorded to chase: remind about the coming month from the bed's rent, once its week begins.
  const dueMs = nextDueMs(schedule.moveInMs, nowMs);
  const period = periodOf(dueMs);
  if (today < reminderOpensMs(dueMs) || allRows.some((r) => r.charge.period === period)) return null;
  const projected: LedgerRow = {
    charge: { id: `${period}-scheduled`, tenantUid: '', period, amountInr: schedule.rentInr, dueMs },
    tenantName,
    paidInr: 0,
    remainingInr: schedule.rentInr,
    status: startOfDay(dueMs) === today ? 'due-today' : 'upcoming',
    daysOverdue: 0,
  };
  return reminderFor({ tenantName, propertyName, rows: [...allRows, projected], row: projected, nowMs });
}

function reminderFor(args: { tenantName: string; propertyName: string; rows: readonly LedgerRow[]; row: LedgerRow; nowMs: number }): RentReminder {
  const { tenantName, propertyName, rows, row, nowMs } = args;
  const month = monthName(row.charge.period);
  const dueDay = startOfDay(row.charge.dueMs);
  const today = startOfDay(nowMs);
  const when =
    dueDay < today
      ? `overdue since ${day(row.charge.dueMs)} (${row.daysOverdue} ${row.daysOverdue === 1 ? 'day' : 'days'})`
      : dueDay === today
        ? 'due today'
        : `due on ${day(row.charge.dueMs)}`;
  const unpaidMonths = rows.filter((r) => r.remainingInr > 0).length;
  const totalInr = totalOutstanding(rows);
  const status: RentReminder['status'] = dueDay < today ? 'overdue' : dueDay === today ? 'due-today' : row.paidInr > 0 ? 'partial' : 'upcoming';
  const message = [
    `Dear ${firstName(tenantName)},`,
    `This is a gentle reminder from ${propertyName} regarding your rent for ${month}.`,
    `Amount payable: ${inr(row.remainingInr)}, ${when}.`,
    ...(unpaidMonths > 1 ? [`Your total outstanding across ${unpaidMonths} months is ${inr(totalInr)}.`] : []),
    'Kindly make the payment at your earliest convenience. Thank you.',
  ].join('\n');
  return { period: row.charge.period, monthLabel: month, amountInr: row.remainingInr, totalInr, unpaidMonths, dueMs: row.charge.dueMs, status, message };
}

/** One reminder per tenant, month and day. */
export function reminderDocId(tenantUid: string, period: string, nowMs: number): string {
  const d = new Date(nowMs);
  const key = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `${tenantUid}_${period}_${key}`;
}

/** A reminder as the tenant reads it. */
export type MyRentReminder = { id: string; propertyId: string; period: string; amountInr: number; message: string; createdMs: number | null };

/** The text of a WhatsApp link that opens a chat with the message already typed. */
export const withMessage = (whatsAppLink: string, message: string): string => `${whatsAppLink}?text=${encodeURIComponent(message)}`;
