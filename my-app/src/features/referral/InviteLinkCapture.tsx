import * as Linking from 'expo-linking';
import { useEffect } from 'react';

import { parseInviteCode } from '@/features/referral/inviteModel';
import { savePendingInvite } from '@/features/referral/referralService';

// Mounted once at the root, outside the auth gate, so a link opened while signed out is still seen.
// It only remembers a well-formed code on the device; the code does nothing until a brand-new
// account is created (see recordInviteAttribution), so opening a link while already registered is
// never counted.
export function InviteLinkCapture() {
  const url = Linking.useLinkingURL();
  useEffect(() => {
    const code = parseInviteCode(url);
    if (code) savePendingInvite(code).catch(() => {});
  }, [url]);
  return null;
}
