// Pure validation and shaping for the Add Tenant form. No React, no Firebase.
import { isGender, type Gender } from '@/constants/account';
import { parseAmount, startOfDay } from '@/features/rent/rentModel';

export const PHONE_COUNTRY = '+91';
const MAX_DEPOSIT_INR = 10_000_000;

export type AddTenantForm = {
  name: string;
  gender: Gender | null;
  phone: string;
  email: string;
  address: string;
  emergencyName: string;
  emergencyPhone: string;
  propertyId: string | null;
  roomId: string | null;
  bedId: string | null;
  rent: string;
  deposit: string;
  /** The owner has already received the security deposit. Only meaningful when a deposit amount is entered. */
  depositCollected: boolean;
  moveInMs: number;
};

export type AddTenantErrors = Partial<
  Record<'name' | 'gender' | 'phone' | 'email' | 'emergency' | 'emergencyPhone' | 'property' | 'room' | 'bed' | 'rent' | 'deposit' | 'moveIn', string>
>;

/** Ten digits (spaces and dashes allowed) for an Indian mobile number, or null. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[\s-]/g, '');
  return /^[0-9]{10}$/.test(digits) ? digits : null;
}

export const isEmail = (raw: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw.trim());

/** Whole rupees from typed text; 0 is allowed (a deposit of nothing). */
export function parseDeposit(raw: string): number | null {
  const text = raw.replace(/[₹,\s]/g, '');
  if (!/^\d{1,8}$/.test(text)) return null;
  const value = Number(text);
  return value <= MAX_DEPOSIT_INR ? value : null;
}

const YEAR_MS = 366 * 86_400_000;

export function validateAddTenant(form: AddTenantForm, nowMs: number): AddTenantErrors {
  const e: AddTenantErrors = {};
  const name = form.name.trim();
  if (name.length < 2) e.name = 'Enter the tenant’s full name.';
  else if (name.length > 100) e.name = 'Use at most 100 characters.';
  if (!isGender(form.gender)) e.gender = 'Choose male or female.';
  if (!form.phone.trim()) e.phone = 'Enter a phone number.';
  else if (normalizePhone(form.phone) === null) e.phone = 'Enter a 10-digit mobile number.';
  if (form.email.trim() && !isEmail(form.email)) e.email = 'Enter a valid email address.';
  const hasEName = form.emergencyName.trim() !== '';
  const hasEPhone = form.emergencyPhone.trim() !== '';
  if (hasEName !== hasEPhone) e.emergency = 'Enter both the emergency contact’s name and phone, or neither.';
  else if (hasEPhone && normalizePhone(form.emergencyPhone) === null) e.emergencyPhone = 'Enter a 10-digit mobile number.';
  if (!form.propertyId) e.property = 'Choose a property.';
  if (!form.roomId) e.room = 'Choose a room.';
  if (!form.bedId) e.bed = 'Choose a vacant bed.';
  if (parseAmount(form.rent) === null) e.rent = 'Enter the monthly rent in whole rupees.';
  if (form.deposit.trim() && parseDeposit(form.deposit) === null) e.deposit = 'Enter a whole-rupee amount.';
  const today = startOfDay(nowMs);
  if (Math.abs(startOfDay(form.moveInMs) - today) > YEAR_MS) e.moveIn = 'Choose a date within a year of today.';
  return e;
}

/** A partial move-in payment must be at least ₹1 and less than the monthly rent. Returns an error or null. */
export function validatePartialCollected(raw: string, rentInr: number | null): string | null {
  const amount = parseAmount(raw);
  if (!raw.trim()) return 'Enter the amount collected.';
  if (amount === null) return 'Enter a whole-rupee amount greater than zero.';
  if (rentInr !== null && amount >= rentInr) return 'A partial payment must be less than the monthly rent. Choose “Full amount” instead.';
  return null;
}

export type EditTenantForm = {
  name: string;
  phone: string;
  email: string;
  address: string;
  emergencyName: string;
  emergencyPhone: string;
};

export type EditTenantErrors = Partial<Record<'name' | 'phone' | 'email' | 'emergency' | 'emergencyPhone', string>>;

/** The same rules as Add Tenant, for the fields the edit sheet can change. */
export function validateEditTenant(form: EditTenantForm): EditTenantErrors {
  const e: EditTenantErrors = {};
  const name = form.name.trim();
  if (name.length < 2) e.name = 'Enter the tenant’s full name.';
  else if (name.length > 100) e.name = 'Use at most 100 characters.';
  if (!form.phone.trim()) e.phone = 'Enter a phone number.';
  else if (normalizePhone(form.phone) === null) e.phone = 'Enter a 10-digit mobile number.';
  if (form.email.trim() && !isEmail(form.email)) e.email = 'Enter a valid email address.';
  const hasName = form.emergencyName.trim() !== '';
  const hasPhone = form.emergencyPhone.trim() !== '';
  if (hasName !== hasPhone) e.emergency = 'Enter both the emergency contact’s name and phone, or neither.';
  else if (hasPhone && normalizePhone(form.emergencyPhone) === null) e.emergencyPhone = 'Enter a 10-digit mobile number.';
  return e;
}

export type ResidentEdit = {
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
};

/** Cleaned values to store (`null` removes an optional field). Call after `validateEditTenant` passes. */
export function toResidentEdit(form: EditTenantForm): ResidentEdit {
  return {
    name: form.name.trim(),
    phone: normalizePhone(form.phone) as string,
    email: form.email.trim() ? form.email.trim().toLowerCase() : null,
    address: form.address.trim() ? form.address.trim().slice(0, 200) : null,
    emergencyName: form.emergencyName.trim() || null,
    emergencyPhone: form.emergencyPhone.trim() ? (normalizePhone(form.emergencyPhone) as string) : null,
  };
}

/** True when the form differs from the saved values once both are cleaned the same way. */
export function isEditDirty(form: EditTenantForm, saved: EditTenantForm): boolean {
  const norm = (f: EditTenantForm) => [f.name.trim(), f.phone.replace(/[\s-]/g, ''), f.email.trim().toLowerCase(), f.address.trim(), f.emergencyName.trim(), f.emergencyPhone.replace(/[\s-]/g, '')].join('|');
  return norm(form) !== norm(saved);
}

export type NewResident = {
  name: string;
  gender: Gender;
  phone: string;
  email: string | null;
  address: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  rentInr: number;
  depositInr: number | null;
  /** Whether the deposit was received. Always false when there is no deposit amount. */
  depositCollected: boolean;
  moveInMs: number;
};

/** The cleaned values to store. Call only after `validateAddTenant` returned no errors. */
export function toNewResident(form: AddTenantForm): NewResident {
  return {
    name: form.name.trim(),
    gender: form.gender as Gender,
    phone: normalizePhone(form.phone) as string,
    email: form.email.trim() ? form.email.trim().toLowerCase() : null,
    address: form.address.trim() ? form.address.trim().slice(0, 200) : null,
    emergencyName: form.emergencyName.trim() || null,
    emergencyPhone: form.emergencyPhone.trim() ? (normalizePhone(form.emergencyPhone) as string) : null,
    rentInr: parseAmount(form.rent) as number,
    depositInr: form.deposit.trim() ? (parseDeposit(form.deposit) as number) : null,
    depositCollected: form.deposit.trim() !== '' && form.depositCollected,
    moveInMs: startOfDay(form.moveInMs),
  };
}

/** The name and 10-digit phone to prefill from a tenant's stay request (the last 10 digits of their number, if there are that many). */
export function prefillFromRequest(name: string | null | undefined, phone: string | null | undefined): { name: string; phone: string } {
  const digits = (phone ?? '').replace(/\D/g, '');
  return { name: (name ?? '').trim().slice(0, 100), phone: digits.length >= 10 ? digits.slice(-10) : '' };
}

/**
 * Whether a bed's claim belongs to the resident being saved: an earlier attempt of this same save
 * (same resident id) already went through. Compared by id, never by name, so a different person who
 * happens to share the name does not look like a repeat of the same save.
 */
export const bedClaimIsOurs = (claimedBy: string | null, residentId: string): boolean => claimedBy !== null && claimedBy === residentId;
