import { TenantDetailsScreen } from '@/features/tenants/TenantDetailsScreen';

// A nested page (outside `(tabs)`): back-arrow header, no bottom navigation. Needs `?propertyId=`.
export default function OwnerTenantDetailsRoute() {
  return <TenantDetailsScreen />;
}
