import { Redirect, router, Stack, type Href } from 'expo-router';

import type { AccountRole } from '@/constants/account';
import { useVerifiedRole } from '@/features/auth/useUserProfile';
import { AppTopBar } from '@/features/navigation/AppTopBar';
import { MainTopBarActions } from '@/features/navigation/MainTopBarActions';
import { HOME_HREF_BY_ROLE, NOTIFICATIONS_HREF_BY_ROLE, PROFILE_HREF_BY_ROLE } from '@/features/navigation/navigationConfig';

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value : Array.isArray(value) ? asString(value[0]) : undefined;

// Root navigator of one role's route group: the `(tabs)` group holds the main pages (with the
// bottom navigation); every other route in the folder is a nested page, pushed on this stack
// above the tabs. That is what hides the bottom navigation there and gives it real back history.
//
// A nested screen gets its header from `options.title` and, optionally, the `propertyName` route
// param, e.g. `router.push({ pathname: '/owner/property-details', params: { id, propertyName } })`.
// The role check is UX only; Firestore Security Rules remain the authorization boundary.
export function RoleStackLayout({ role, backFallback }: { role: AccountRole; backFallback?: Href }) {
  const verifiedRole = useVerifiedRole();
  if (verifiedRole === null) return null;
  if (verifiedRole !== role) return <Redirect href={HOME_HREF_BY_ROLE[verifiedRole]} />;

  // Without history (e.g. opened from a link) go to the parent, never leave the user stranded.
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(backFallback ?? HOME_HREF_BY_ROLE[role]);
  };

  return (
    <Stack
      screenOptions={{
        header: ({ options, route }) => (
          <AppTopBar
            title={options.title ?? 'HOSTELL'}
            propertyName={
              // A screen can set its second line (e.g. a property name it fetched) as a string `headerTitle`.
              typeof options.headerTitle === 'string'
                ? options.headerTitle
                : asString((route.params as Record<string, unknown> | undefined)?.propertyName)
            }
            onBack={goBack}
            actions={
              <>
                {options.headerRight?.({ canGoBack: true })}
                <MainTopBarActions profileHref={PROFILE_HREF_BY_ROLE[role]} notificationsHref={NOTIFICATIONS_HREF_BY_ROLE[role]} />
              </>
            }
          />
        ),
      }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
