import { AddTenantScreen } from '@/features/tenants/AddTenantScreen';

// A nested page (outside `(tabs)`): back-arrow header, no bottom navigation. Optional `?propertyId=`.
export default function OwnerAddTenantRoute() {
  return <AddTenantScreen />;
}
