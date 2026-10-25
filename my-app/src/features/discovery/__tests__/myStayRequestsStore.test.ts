import AsyncStorage from '@react-native-async-storage/async-storage';

import { loadStoredStayRequests, saveStoredStayRequests } from '@/features/discovery/myStayRequestsStore';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

describe('stored stay requests', () => {
  beforeEach(() => AsyncStorage.clear());

  it('survives a reload, per account', async () => {
    const item = { propertyId: 'p1', status: 'pending' as const, message: 'hi', createdMs: 1, updatedMs: 2 };
    await saveStoredStayRequests('u1', [item]);
    expect(await loadStoredStayRequests('u1')).toEqual([item]);
    expect(await loadStoredStayRequests('u2')).toEqual([]);
  });

  it('ignores corrupt or unknown entries', async () => {
    await AsyncStorage.setItem('hostell.myStayRequests.v1.u1', JSON.stringify([{ propertyId: 'p', status: 'bogus' }, { status: 'pending' }, { propertyId: 'p2', status: 'approved' }]));
    expect((await loadStoredStayRequests('u1')).map((r) => r.propertyId)).toEqual(['p2']);
    await AsyncStorage.setItem('hostell.myStayRequests.v1.u1', 'not json');
    expect(await loadStoredStayRequests('u1')).toEqual([]);
  });
});
