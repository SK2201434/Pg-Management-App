import { doc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';

import { getFirestoreDb } from '@/config/firebase';

const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
export const TENANT_INVITE_DAYS = 7;

/** 24 random characters; the rules need at least 20. It is a single-use, expiring code, not a password. */
export function generateTenantInviteCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < 24; i += 1) code += CHARS[Math.floor(random() * CHARS.length)];
  return code;
}

export const buildTenantInviteMessage = (propertyName: string, code: string): string =>
  `You are invited to join ${propertyName} on HOSTELL. Install the app, create a tenant account, and enter this code when asked: ${code}. It works once and expires in ${TENANT_INVITE_DAYS} days.`;

/**
 * Creates the single-use property-join code that a tenant enters when creating their account
 * (the existing referral flow: it adds them to this property as a member). The rules require the
 * caller to own the property, one use, and an expiry within 30 days.
 */
export async function createTenantInvite(propertyId: string, ownerUid: string): Promise<{ code: string; expiresMs: number }> {
  const code = generateTenantInviteCode();
  const expiresMs = Date.now() + TENANT_INVITE_DAYS * 24 * 60 * 60 * 1000;
  await setDoc(doc(getFirestoreDb(), 'referrals', code), {
    type: 'property_join',
    createdBy: ownerUid,
    propertyId,
    status: 'active',
    maxUses: 1,
    useCount: 0,
    expiresAt: Timestamp.fromMillis(expiresMs),
    createdAt: serverTimestamp(),
  });
  return { code, expiresMs };
}
