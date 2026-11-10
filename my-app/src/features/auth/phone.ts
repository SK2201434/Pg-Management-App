// The phone number every account must have: exactly ten digits (an Indian mobile number, the same
// shape residents are stored with). It is also what an owner's resident is matched against, so the
// format must be strict. Not verified by HOSTELL: matching only ever suggests, the owner confirms.

export const PHONE_DIGITS = 10;
export const PHONE_ERROR = 'Enter a 10-digit mobile number.';

export const isValidPhone = (value: string | null | undefined): value is string => typeof value === 'string' && /^[0-9]{10}$/.test(value);

/** Keeps only digits, at most ten, for use as the field's change handler. */
export const digitsOnly = (value: string): string => value.replace(/\D/g, '').slice(0, PHONE_DIGITS);
