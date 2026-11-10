// Pure profile helpers: what may be edited and how it is validated. No React, no Firebase.
import { isValidPhone, PHONE_ERROR } from '@/features/auth/phone';

/** The only fields a user may change on their own profile (the rules allow exactly these). */
export type EditableProfile = { displayName: string; phone: string };
export type ProfileErrors = { displayName?: string; phone?: string };

export function validateProfile(input: EditableProfile): ProfileErrors {
  const errors: ProfileErrors = {};
  const name = input.displayName.trim();
  if (name.length < 2) errors.displayName = 'Enter your full name.';
  else if (name.length > 100) errors.displayName = 'Use at most 100 characters.';
  if (!isValidPhone(input.phone.trim())) errors.phone = PHONE_ERROR;
  return errors;
}

export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return ((parts[0][0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** "October 2024", or null when the date is unknown. */
export function formatMemberSince(ms: number | null): string | null {
  if (ms === null) return null;
  return new Date(ms).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}
