import { TenantUpdatesScreen } from '@/features/tenantHome/TenantUpdatesScreen';

// A nested page (outside `(tabs)`): back-arrow header, no bottom navigation. The tenant role guard
// is the RoleStackLayout of this folder.
export default function TenantUpdatesRoute() {
  return <TenantUpdatesScreen />;
}
