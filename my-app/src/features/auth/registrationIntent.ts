import AsyncStorage from '@react-native-async-storage/async-storage';

import { AccountRoles, isGender, type AccountType, type Gender } from '@/constants/account';

/**
 * What the user chose on the Create Account screen. It is kept on the device, keyed by Firebase
 * UID, because no profile may be written before the email is verified and the user usually leaves
 * the app to open the verification link. It is not authorization: the role is only ever granted by
 * the Firestore rules when the profile is created.
 */
export type RegistrationIntent = {
  accountType: AccountType;
  phone?: string;
  gender?: Gender;
  referralCode?: string;
};

const keyFor = (uid: string) => `registration_intent:${uid}`;

function parseIntent(raw: string | null): RegistrationIntent | null {
  if (raw === null) return null;
  try {
    const value = JSON.parse(raw) as Partial<Record<keyof RegistrationIntent, unknown>> | null;
    if (value?.accountType !== AccountRoles.Owner && value?.accountType !== AccountRoles.Tenant) {
      return null;
    }
    return {
      accountType: value.accountType,
      ...(typeof value.phone === 'string' && value.phone !== '' ? { phone: value.phone } : {}),
      ...(isGender(value.gender) ? { gender: value.gender } : {}),
      ...(typeof value.referralCode === 'string' && value.referralCode !== ''
        ? { referralCode: value.referralCode }
        : {}),
    };
  } catch {
    return null;
  }
}

export async function saveRegistrationIntent(uid: string, intent: RegistrationIntent) {
  await AsyncStorage.setItem(keyFor(uid), JSON.stringify(intent));
}

/** The saved intent, or null if there is none (or it is unreadable): the caller must handle that. */
export async function loadRegistrationIntent(uid: string): Promise<RegistrationIntent | null> {
  try {
    return parseIntent(await AsyncStorage.getItem(keyFor(uid)));
  } catch {
    return null;
  }
}

export async function clearRegistrationIntent(uid: string) {
  try {
    await AsyncStorage.removeItem(keyFor(uid));
  } catch {
    // A leftover intent is harmless: provisioning is skipped once the profile exists.
  }
}
