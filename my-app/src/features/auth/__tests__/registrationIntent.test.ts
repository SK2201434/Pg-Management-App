import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  clearRegistrationIntent,
  loadRegistrationIntent,
  saveRegistrationIntent,
} from '@/features/auth/registrationIntent';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

beforeEach(() => AsyncStorage.clear());

describe('registration intent', () => {
  it('round-trips per uid', async () => {
    await saveRegistrationIntent('u1', { accountType: 'tenant', referralCode: 'x'.repeat(24) });
    await saveRegistrationIntent('u2', { accountType: 'owner' });
    expect(await loadRegistrationIntent('u1')).toEqual({
      accountType: 'tenant',
      referralCode: 'x'.repeat(24),
    });
    expect(await loadRegistrationIntent('u2')).toEqual({ accountType: 'owner' });
  });

  it('returns null when missing, so the caller must ask safely', async () => {
    expect(await loadRegistrationIntent('nobody')).toBeNull();
  });

  it('rejects a tampered or unknown role instead of trusting it', async () => {
    await AsyncStorage.setItem('registration_intent:u1', JSON.stringify({ accountType: 'admin' }));
    expect(await loadRegistrationIntent('u1')).toBeNull();
    await AsyncStorage.setItem('registration_intent:u1', 'not json');
    expect(await loadRegistrationIntent('u1')).toBeNull();
  });

  it('clears', async () => {
    await saveRegistrationIntent('u1', { accountType: 'owner' });
    await clearRegistrationIntent('u1');
    expect(await loadRegistrationIntent('u1')).toBeNull();
  });
});
