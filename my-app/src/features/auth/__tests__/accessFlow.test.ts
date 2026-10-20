import { getAccessStep } from '@/features/auth/accessStep';
import { getResendCooldownRemaining, RESEND_COOLDOWN_SECONDS } from '@/features/auth/resendCooldown';
import { HOME_HREF_BY_ROLE } from '@/features/navigation/navigationConfig';

const ready = {
  state: 'ready',
  profile: { uid: 'u', role: 'owner', status: 'active', displayName: null },
} as const;

describe('getAccessStep (routing)', () => {
  it('sends an unverified user to verification whatever the profile says', () => {
    expect(getAccessStep({ emailVerified: false }, undefined)).toBe('verify-email');
    expect(getAccessStep({ emailVerified: false }, { state: 'missing' })).toBe('verify-email');
    expect(getAccessStep({ emailVerified: false }, ready)).toBe('verify-email');
  });

  it('creates the profile only for a verified user without one', () => {
    expect(getAccessStep({ emailVerified: true }, { state: 'missing' })).toBe('set-up-profile');
  });

  it('opens the dashboard only for a verified user with a ready profile', () => {
    expect(getAccessStep({ emailVerified: true }, ready)).toBe('dashboard');
    expect(getAccessStep({ emailVerified: true }, undefined)).toBe('account-unavailable');
    expect(getAccessStep({ emailVerified: true }, { state: 'disabled' })).toBe('account-unavailable');
    expect(getAccessStep({ emailVerified: true }, { state: 'invalid' })).toBe('account-unavailable');
  });

  it('routes each role to its own home', () => {
    expect(HOME_HREF_BY_ROLE.owner).toContain('owner');
    expect(HOME_HREF_BY_ROLE.tenant).toContain('tenant');
  });
});

describe('resend cooldown', () => {
  it('allows the first send', () => {
    expect(getResendCooldownRemaining(null)).toBe(0);
  });

  it('blocks resends until the cooldown has passed', () => {
    expect(getResendCooldownRemaining(1_000, 1_000)).toBe(RESEND_COOLDOWN_SECONDS);
    expect(getResendCooldownRemaining(1_000, 1_000 + 30_000)).toBe(RESEND_COOLDOWN_SECONDS - 30);
    expect(getResendCooldownRemaining(1_000, 1_000 + RESEND_COOLDOWN_SECONDS * 1000)).toBe(0);
  });
});
