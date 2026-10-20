import { checkEmailVerified, sendVerificationEmail } from '@/features/auth/emailVerification';

const mockSend = jest.fn();
const mockUser = {
  uid: 'u1',
  email: 'a@b.co',
  displayName: 'A',
  emailVerified: false,
  reload: jest.fn(),
  getIdToken: jest.fn(),
};
let mockCurrentUser: typeof mockUser | null = mockUser;

jest.mock('firebase/auth', () => ({ sendEmailVerification: (...args: unknown[]) => mockSend(...args) }));
jest.mock('@/config/firebase', () => ({
  getFirebaseAuth: () => ({ get currentUser() { return mockCurrentUser; } }),
}));
jest.mock('@/features/auth/ownerAuthSlice', () => ({
  authStateChanged: (user: unknown) => ({ type: 'authStateChanged', payload: user }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockCurrentUser = mockUser;
  mockUser.emailVerified = false;
  mockUser.reload.mockResolvedValue(undefined);
  mockUser.getIdToken.mockResolvedValue('token');
});

describe('checkEmailVerified', () => {
  it('stays pending, without refreshing the token or touching state, while unverified', async () => {
    const dispatch = jest.fn();
    await expect(checkEmailVerified(dispatch)).resolves.toEqual({ status: 'pending' });
    expect(mockUser.reload).toHaveBeenCalled();
    expect(mockUser.getIdToken).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('refreshes the token and publishes the verified user once Firebase confirms', async () => {
    mockUser.reload.mockImplementation(async () => {
      mockUser.emailVerified = true;
    });
    const dispatch = jest.fn();
    await expect(checkEmailVerified(dispatch)).resolves.toEqual({ status: 'verified' });
    expect(mockUser.getIdToken).toHaveBeenCalledWith(true);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ uid: 'u1', emailVerified: true }) }),
    );
  });

  it('reports a network failure instead of throwing', async () => {
    mockUser.reload.mockRejectedValue({ code: 'auth/network-request-failed' });
    const result = await checkEmailVerified(jest.fn());
    expect(result.status).toBe('error');
  });

  it('reports a signed-out user', async () => {
    mockCurrentUser = null;
    expect((await checkEmailVerified(jest.fn())).status).toBe('error');
  });
});

describe('sendVerificationEmail', () => {
  it('resolves to null when the email was sent', async () => {
    mockSend.mockResolvedValue(undefined);
    await expect(sendVerificationEmail()).resolves.toBeNull();
    expect(mockSend).toHaveBeenCalledWith(mockUser);
  });

  it('returns a message on throttling', async () => {
    mockSend.mockRejectedValue({ code: 'auth/too-many-requests' });
    const error = await sendVerificationEmail();
    expect(error?.message).toMatch(/too many/i);
  });
});
