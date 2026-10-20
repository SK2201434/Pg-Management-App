import { AccountRoles } from '@/constants/account';
import { RoleTabsLayout } from '@/features/navigation/RoleTabsLayout';

export default function TenantTabsLayout() {
  return <RoleTabsLayout role={AccountRoles.Tenant} />;
}
