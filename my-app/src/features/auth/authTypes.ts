import type { Timestamp } from 'firebase/firestore';

import type { AccountRole, AccountStatus, AccountType } from '@/constants/account';

// Owner authentication contracts (backend/app/schemas/auth.py).
// UUIDs are strings in JSON. Tenant authentication has its own, separate contracts.

/** POST /api/v1/auth/register */
export type OwnerRegisterRequest = {
  /** 2–100 characters. */
  full_name: string;
  email: string;
  /** 8–128 characters. */
  password: string;
};

/** POST /api/v1/auth/login */
export type OwnerLoginRequest = {
  email: string;
  password: string;
};

/** Response of POST /api/v1/auth/register (201) and GET /api/v1/auth/me. */
export type OwnerResponse = {
  /** UUID. */
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
};

/** Response of POST /api/v1/auth/login. The backend sends `"bearer"` by default. */
export type TokenResponse = {
  access_token: string;
  token_type: string;
};

/**
 * The signed-in user as held in Redux, derived from the Firebase Auth user. It carries identity
 * only: no tokens, no password and no role. Application roles are not granted by the client.
 */
export type OwnerUser = {
  /** Firebase Auth UID. */
  uid: string;
  email: string | null;
  displayName: string | null;
  /** Whether Firebase has verified the email address (Google accounts arrive verified). */
  emailVerified: boolean;
};

/**
 * A user's Firestore profile. It holds no credentials: passwords stay in Firebase Auth.
 * `role` and `status` are authorization data and are written only by trusted provisioning.
 * `accountType` records the type the user chose at sign-up and is not trusted on its own.
 */
export type UserProfile = {
  /** Firebase Auth UID, also the document ID. */
  uid: string;
  accountType: AccountType;
  role: AccountRole;
  status: AccountStatus;
  displayName: string;
  email: string;
  phone?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
