import type { Href } from 'expo-router';
import Tabs from 'expo-router/js-tabs';

import { AccountRoles, type AccountRole } from '@/constants/account';
import { AppTopBar } from '@/features/navigation/AppTopBar';
import { BottomNavigation } from '@/features/navigation/BottomNavigation';
import { TenantSearchButton } from '@/features/discovery/TenantSearch';
import { TenantTopBar } from '@/features/discovery/TenantTopBar';
import { TenantNotificationBell } from '@/features/tenantNotifications/TenantNotificationBell';
import { MainTopBarActions } from '@/features/navigation/MainTopBarActions';
import { NAV_BY_ROLE, NOTIFICATIONS_HREF_BY_ROLE, PROFILE_HREF_BY_ROLE } from '@/features/navigation/navigationConfig';

// The four main pages of one role (the `(tabs)` group): top bar with a contextual icon plus the
// bottom navigation. The role guard lives in RoleStackLayout, which wraps this group.
export function RoleTabsLayout({ role }: { role: AccountRole }) {
  const items = NAV_BY_ROLE[role];
  const TopBar = role === AccountRoles.Tenant ? TenantTopBar : AppTopBar;
  const profileHref: Href = PROFILE_HREF_BY_ROLE[role];
  return (
    <Tabs
      screenOptions={{
        header: ({ route }) => {
          const item = items.find((i) => i.routeName === route.name);
          return (
            <TopBar
              title={item?.title ?? item?.label ?? ''}
              subtitle={item?.subtitle}
              leadingIcon={item?.icon}
              actions={<MainTopBarActions profileHref={profileHref} notificationsHref={NOTIFICATIONS_HREF_BY_ROLE[role]} bell={role === AccountRoles.Tenant ? <><TenantSearchButton /><TenantNotificationBell href={NOTIFICATIONS_HREF_BY_ROLE[role]} /></> : undefined} />}
            />
          );
        },
      }}
      tabBar={(props) => <BottomNavigation {...props} items={items} />}
    />
  );
}
