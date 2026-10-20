import {
  classifyReferral,
  provisionProfile,
  ProvisioningError,
} from '@/features/auth/userProvisioning';

const mockBatch = { set: jest.fn(), update: jest.fn(), commit: jest.fn() };
const mockGetDoc = jest.fn();
const mockUser = {
  uid: 'u1',
  email: 'a@b.co',
  displayName: 'Asha',
  emailVerified: true,
  reload: jest.fn(),
  getIdToken: jest.fn(),
};

jest.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  serverTimestamp: () => 'SERVER_TIME',
  writeBatch: () => mockBatch,
}));
jest.mock('@/config/firebase', () => ({
  getFirebaseAuth: () => ({ currentUser: mockUser }),
  getFirestoreDb: () => ({}),
}));

const CODE = 'abcdefghijklmnopqrstuvwxyz012345';
const future = { toMillis: () => Date.now() + 60_000 };
const snap = (data?: Record<string, unknown>) => ({ exists: () => data !== undefined, data: () => data });
const referral = { type: 'property_join', status: 'active', expiresAt: future, propertyId: 'p1', createdBy: 'o1' };

beforeEach(() => {
  jest.clearAllMocks();
  mockUser.emailVerified = true;
  mockUser.reload.mockResolvedValue(undefined);
  mockUser.getIdToken.mockResolvedValue('t');
  mockBatch.commit.mockResolvedValue(undefined);
  mockGetDoc.mockResolvedValue(snap(undefined)); // no profile yet
});

describe('classifyReferral', () => {
  it('accepts an active, unexpired property-join referral', () => {
    expect(classifyReferral(referral)).toBeNull();
  });
  it('rejects missing, wrong-type, used, revoked and expired referrals', () => {
    expect(classifyReferral(undefined)).toBe('referral-invalid');
    expect(classifyReferral({ ...referral, type: 'owner_referral' })).toBe('referral-invalid');
    expect(classifyReferral({ ...referral, status: 'used' })).toBe('referral-used');
    expect(classifyReferral({ ...referral, status: 'revoked' })).toBe('referral-invalid');
    expect(classifyReferral({ ...referral, expiresAt: { toMillis: () => 1 } })).toBe('referral-expired');
  });
});

describe('provisionProfile', () => {
  it('does not write anything for an unverified email', async () => {
    mockUser.emailVerified = false;
    await expect(provisionProfile({ uid: 'u1', intent: { accountType: 'owner' } })).rejects.toMatchObject({
      kind: 'email-unverified',
    });
    expect(mockBatch.commit).not.toHaveBeenCalled();
    expect(mockUser.getIdToken).not.toHaveBeenCalled();
  });

  it('creates the profile with the registered type, after refreshing the token', async () => {
    await provisionProfile({ uid: 'u1', intent: { accountType: 'owner', phone: '+911234567' } });
    expect(mockUser.getIdToken).toHaveBeenCalledWith(true);
    expect(mockBatch.set).toHaveBeenCalledTimes(1);
    expect(mockBatch.set.mock.calls[0][1]).toMatchObject({
      uid: 'u1',
      role: 'owner',
      accountType: 'owner',
      status: 'active',
      email: 'a@b.co',
      phone: '+911234567',
    });
    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
  });

  it('is idempotent: an existing profile is left untouched', async () => {
    mockGetDoc.mockResolvedValue(snap({ role: 'tenant' }));
    await provisionProfile({ uid: 'u1', intent: { accountType: 'owner' } });
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });

  it('consumes a valid referral with the profile and membership in one batch', async () => {
    mockGetDoc.mockResolvedValueOnce(snap(undefined)).mockResolvedValueOnce(snap(referral));
    await provisionProfile({ uid: 'u1', intent: { accountType: 'tenant', referralCode: CODE } });
    expect(mockBatch.set).toHaveBeenCalledTimes(2);
    expect(mockBatch.update).toHaveBeenCalledWith(
      { path: `referrals/${CODE}` },
      expect.objectContaining({ status: 'used', useCount: 1, usedBy: 'u1' }),
    );
    expect(mockBatch.set.mock.calls[1][0]).toEqual({ path: 'properties/p1/members/u1' });
    expect(mockBatch.set.mock.calls[1][1]).toMatchObject({ ownerUid: 'o1', propertyId: 'p1' });
    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['missing', undefined, 'referral-invalid'],
    ['used', { ...referral, status: 'used' }, 'referral-used'],
    ['expired', { ...referral, expiresAt: { toMillis: () => 1 } }, 'referral-expired'],
  ])('writes nothing for a %s referral', async (_name, data, kind) => {
    mockGetDoc.mockResolvedValueOnce(snap(undefined)).mockResolvedValueOnce(snap(data));
    await expect(
      provisionProfile({ uid: 'u1', intent: { accountType: 'tenant', referralCode: CODE } }),
    ).rejects.toMatchObject({ kind });
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });

  it('refuses a referral for an owner account', async () => {
    await expect(
      provisionProfile({ uid: 'u1', intent: { accountType: 'owner', referralCode: CODE } }),
    ).rejects.toMatchObject({ kind: 'referral-wrong-role' });
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });

  it('keeps the original Firebase code when the batch is rejected', async () => {
    mockBatch.commit.mockRejectedValue({ code: 'permission-denied' });
    const error = await provisionProfile({ uid: 'u1', intent: { accountType: 'tenant' } }).catch((e) => e);
    expect(error).toBeInstanceOf(ProvisioningError);
    expect(error).toMatchObject({ kind: 'permission-denied', code: 'permission-denied' });
  });

  it('reports a lost referral race as a referral failure', async () => {
    mockGetDoc.mockResolvedValueOnce(snap(undefined)).mockResolvedValueOnce(snap(referral));
    mockBatch.commit.mockRejectedValue({ code: 'permission-denied' });
    await expect(
      provisionProfile({ uid: 'u1', intent: { accountType: 'tenant', referralCode: CODE } }),
    ).rejects.toMatchObject({ kind: 'referral-rejected' });
  });
});
