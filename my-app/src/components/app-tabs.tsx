import { Slot } from 'expo-router';

import { ProfileGate } from '@/features/auth/ProfileGate';

// Renders the role-based app (`/owner/*` or `/tenant/*`, each with its own bottom navigation)
// only for a user with a valid, active profile.
export default function AppTabs() {
  return (
    <ProfileGate>
      <Slot />
    </ProfileGate>
  );
}
