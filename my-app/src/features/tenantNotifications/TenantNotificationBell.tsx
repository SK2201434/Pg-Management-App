import type { Href } from 'expo-router';

import { useMyStayRequestsListener } from '@/features/discovery/myStayRequestsLive';
import { BellButton } from '@/features/notifications/NotificationBell';
import { useTenantNotifications } from '@/features/tenantNotifications/useTenantNotifications';

/** The tenant's bell: the dot shows only for the tenant's own unread notifications. */
export function TenantNotificationBell({ href }: { href: Href | null }) {
  // The bell is always on screen, so it keeps the tenant's stay requests live (one listener).
  useMyStayRequestsListener();
  const { unread } = useTenantNotifications();
  if (href === null) return null;
  return <BellButton href={href} unread={unread} />;
}
