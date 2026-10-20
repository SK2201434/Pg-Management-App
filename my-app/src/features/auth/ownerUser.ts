import type { User } from 'firebase/auth';

import type { OwnerUser } from '@/features/auth/authTypes';

/** Copies only the plain identity fields, so no SDK object or token reaches Redux. */
export function toOwnerUser(user: User): OwnerUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    emailVerified: user.emailVerified,
  };
}
