import {
  buildShareMessage,
  generateInviteCode,
  isInviteCode,
  parseInviteCode,
  parsePendingInvite,
  PENDING_INVITE_MAX_AGE_MS,
  referralStats,
  sortReferrals,
  type ReferralRecord,
} from '@/features/referral/inviteModel';

const rec = (id: string, status: ReferralRecord['status'], registeredMs: number | null): ReferralRecord => ({
  id,
  status,
  registeredMs,
  completedMs: null,
});

describe('invite codes', () => {
  it('generates well-formed codes from the allowed alphabet', () => {
    for (let i = 0; i < 50; i += 1) expect(isInviteCode(generateInviteCode())).toBe(true);
    expect(generateInviteCode(() => 0)).toBe('AAAAAAAAAA');
  });
  it('rejects malformed codes', () => {
    for (const bad of ['', 'abc', 'ABCDEFGHJ', 'ABCDEFGHJKM', 'abcdefghjk', 'ABC DEFGHJ', undefined, 5]) {
      expect(isInviteCode(bad)).toBe(false);
    }
  });
});

describe('parseInviteCode', () => {
  it('reads the code from app, Expo Go and query links, case-insensitively', () => {
    expect(parseInviteCode('myapp://invite/K7M2Q9XPTR')).toBe('K7M2Q9XPTR');
    expect(parseInviteCode('exp://192.168.1.5:8081/--/invite/k7m2q9xptr')).toBe('K7M2Q9XPTR');
    expect(parseInviteCode('myapp://invite/K7M2Q9XPTR?x=1')).toBe('K7M2Q9XPTR');
    expect(parseInviteCode('https://example.test/join?ref=k7m2q9xptr')).toBe('K7M2Q9XPTR');
  });
  it('rejects anything else', () => {
    for (const bad of [null, undefined, '', 'myapp://invite/short', 'myapp://other/K7M2Q9XPTR', 'myapp://invite/K7M2Q9XPTRZZ']) {
      expect(parseInviteCode(bad)).toBeNull();
    }
  });
});

describe('referralStats', () => {
  it('keeps registered, completed and pending separate', () => {
    const stats = referralStats([rec('a', 'registered', 1), rec('b', 'completed', 2), rec('c', 'completed', 3)]);
    expect(stats).toEqual({ registered: 3, completed: 2, pending: 1 });
    expect(referralStats([])).toEqual({ registered: 0, completed: 0, pending: 0 });
  });
  it('sorts newest first', () => {
    expect(sortReferrals([rec('a', 'registered', 1), rec('b', 'registered', 5), rec('c', 'registered', null)]).map((r) => r.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('pending invite', () => {
  const now = 1_700_000_000_000;
  const raw = (savedMs: number) => JSON.stringify({ code: 'K7M2Q9XPTR', savedMs });
  it('accepts a recent one and drops expired, future, or malformed ones', () => {
    expect(parsePendingInvite(raw(now - 1000), now)?.code).toBe('K7M2Q9XPTR');
    expect(parsePendingInvite(raw(now - PENDING_INVITE_MAX_AGE_MS - 1), now)).toBeNull();
    expect(parsePendingInvite(raw(now + 3_600_000), now)).toBeNull();
    expect(parsePendingInvite('{bad', now)).toBeNull();
    expect(parsePendingInvite(null, now)).toBeNull();
    expect(parsePendingInvite(JSON.stringify({ code: 'x', savedMs: now }), now)).toBeNull();
  });
});

describe('share message', () => {
  it('contains the link and promises no reward', () => {
    const message = buildShareMessage('myapp://invite/K7M2Q9XPTR');
    expect(message).toContain('myapp://invite/K7M2Q9XPTR');
    expect(message.toLowerCase()).not.toMatch(/cash|reward|earn|₹|free/);
  });
});
