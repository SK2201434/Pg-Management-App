import { AccountRoles } from '@/constants/account';
import { RoleStackLayout } from '@/features/navigation/RoleStackLayout';

// Nested pages opened from a tab are routes in this folder; `(tabs)` is the anchor, so a nested
// page opened by a link still has the tabs beneath it in the history.
export const unstable_settings = { anchor: '(tabs)' };

export default function TenantLayout() {
  return <RoleStackLayout role={AccountRoles.Tenant} />;
}
