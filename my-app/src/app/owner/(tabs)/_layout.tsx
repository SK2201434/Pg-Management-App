import { AccountRoles } from '@/constants/account';
import { RoleTabsLayout } from '@/features/navigation/RoleTabsLayout';

export default function OwnerTabsLayout() {
  return <RoleTabsLayout role={AccountRoles.Owner} />;
}
