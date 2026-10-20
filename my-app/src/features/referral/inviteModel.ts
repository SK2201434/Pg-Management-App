// Pure model of the "refer a friend" invite feature: codes, links, and the dashboard numbers.
// No React, no Firebase, no storage. See firestore.rules (inviteOwners / inviteCodes / inviteReferrals).

// No 0/O/1/I/L, so a code read aloud or typed by hand is not misread. 31^10 combinations.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 10;
const INVITE_CODE_PATTERN = /^[A-Z0-9]{10}$/;

/** A random code. It is an identifier, not a secret; uniqueness is enforced by Firestore. */
export function generateInviteCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i += 1) code += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return code;
}

export const isInviteCode = (value: unknown): value is string =>
  typeof value === 'string' && INVITE_CODE_PATTERN.test(value);

/**
 * The invite code in a link the app was opened with, or null. Accepts the app scheme
 * (`myapp://invite/CODE`), Expo Go (`exp://host:8081/--/invite/CODE`) and `?ref=CODE`, whatever the
 * letter case. Anything that is not a well-formed code is rejected.
 */
export function parseInviteCode(url: string | null | undefined): string | null {
  if (!url) return null;
  const path = /\/invite\/([A-Za-z0-9]+)(?:[/?#]|$)/.exec(url);
  const query = /[?&]ref=([A-Za-z0-9]+)(?:[&#]|$)/.exec(url);
  const candidate = (path?.[1] ?? query?.[1] ?? '').toUpperCase();
  return isInviteCode(candidate) ? candidate : null;
}

export const buildShareMessage = (url: string): string =>
  `Join me on HOSTELL, the app for managing hostels and PGs. Open this link to get started: ${url}`;

export type ReferralStatus = 'registered' | 'completed';

export type ReferralRecord = {
  /** Id of the referred account's record. Never shown. */
  id: string;
  status: ReferralStatus;
  registeredMs: number | null;
  completedMs: number | null;
};

export type ReferralStats = { registered: number; completed: number; pending: number };

/**
 * `registered` counts every referred account (including those who completed), `completed` those
 * whose profile is complete, `pending` the rest. Link opens are not tracked, so there is no
 * "attributed" count here.
 */
export function referralStats(records: readonly ReferralRecord[]): ReferralStats {
  const completed = records.filter((r) => r.status === 'completed').length;
  return { registered: records.length, completed, pending: records.length - completed };
}

/** Newest first. */
export const sortReferrals = (records: readonly ReferralRecord[]): ReferralRecord[] =>
  [...records].sort((a, b) => (b.registeredMs ?? 0) - (a.registeredMs ?? 0));

// ---- a link captured from outside, kept until sign-up ----

export const PENDING_INVITE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type PendingInvite = { code: string; savedMs: number };

export function parsePendingInvite(raw: string | null, nowMs: number): PendingInvite | null {
  if (raw === null) return null;
  try {
    const value = JSON.parse(raw) as Partial<PendingInvite> | null;
    if (!isInviteCode(value?.code) || typeof value?.savedMs !== 'number') return null;
    if (nowMs - value.savedMs > PENDING_INVITE_MAX_AGE_MS || value.savedMs > nowMs + 60_000) return null;
    return { code: value.code, savedMs: value.savedMs };
  } catch {
    return null;
  }
}
