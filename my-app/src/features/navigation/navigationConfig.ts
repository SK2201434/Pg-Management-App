import type MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';

import { AccountRoles, type AccountRole } from '@/constants/account';
import { APP_TAGLINE } from '@/constants/brand';

export type NavItem = {
  /** Route file name inside the role's tab layout (`index` is the role's home). */
  routeName: string;
  label: string;
  icon: ComponentProps<typeof MaterialIcons>['name'];
  /** Top-bar title, when it differs from the tab label. */
  title?: string;
  /** Top-bar second line. */
  subtitle: string;
};

// Icons are the MaterialIcons equivalents of the Stitch Material Symbols names. MaterialIcons has
// no `concierge`, so Requests uses `room-service`, the closest service-bell glyph.
const OWNER_NAV: readonly NavItem[] = [
  { routeName: 'index', label: 'Home', icon: 'dashboard', title: 'Dashboard', subtitle: APP_TAGLINE },
  { routeName: 'properties', label: 'Properties', icon: 'real-estate-agent', subtitle: 'Manage your properties' },
  { routeName: 'tenants', label: 'Tenants', icon: 'group', title: 'Tenants Overview', subtitle: 'Manage your residents across all properties' },
  { routeName: 'more', label: 'More', icon: 'menu', title: 'More', subtitle: 'HOSTELL account and settings' },
];

const TENANT_NAV: readonly NavItem[] = [
  { routeName: 'index', label: 'Home', icon: 'cottage', subtitle: 'Welcome to your stay' },
  { routeName: 'my-stay', label: 'My Stay', icon: 'calendar-today', subtitle: 'Your accommodation details' },
  { routeName: 'requests', label: 'Requests', icon: 'room-service', subtitle: 'Service requests' },
  { routeName: 'more', label: 'More', icon: 'grid-view', subtitle: 'Account' },
];

export const NAV_BY_ROLE: Record<AccountRole, readonly NavItem[]> = {
  [AccountRoles.Owner]: OWNER_NAV,
  [AccountRoles.Tenant]: TENANT_NAV,
};

/** Each role's route group. Owner and tenant screens live under separate folders. */
export const HOME_HREF_BY_ROLE = {
  [AccountRoles.Owner]: '/owner',
  [AccountRoles.Tenant]: '/tenant',
} as const;

/** What the top bar's profile button opens: the owner's profile page; the tenant's More tab. */
export const PROFILE_HREF_BY_ROLE = {
  [AccountRoles.Owner]: '/owner/profile',
  [AccountRoles.Tenant]: '/tenant/more',
} as const;

/** Where the top bar's bell goes. Each role has its own notifications page. */
export const NOTIFICATIONS_HREF_BY_ROLE = {
  [AccountRoles.Owner]: '/owner/notifications',
  [AccountRoles.Tenant]: '/tenant/notifications',
} as const;
