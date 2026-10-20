import { Redirect } from 'expo-router';

import { useVerifiedRole } from '@/features/auth/useUserProfile';
import { HOME_HREF_BY_ROLE } from '@/features/navigation/navigationConfig';

// Entry route: sends the signed-in user to their role's home. The role comes from the verified
// Firestore profile (see ProfileGate), never from sign-up input or a default.
export default function Index() {
  const role = useVerifiedRole();
  return role === null ? null : <Redirect href={HOME_HREF_BY_ROLE[role]} />;
}
