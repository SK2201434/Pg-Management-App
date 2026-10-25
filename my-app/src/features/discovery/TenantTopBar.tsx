import { usePathname } from 'expo-router';

import { AppTopBar, type AppTopBarProps } from '@/features/navigation/AppTopBar';
import { DISCOVER_PATH, TenantSearchField } from '@/features/discovery/TenantSearch';
import { useSearchState } from '@/features/discovery/searchStore';

/** The shared top bar for tenants: identical, except that it can expand into the property search field. */
export function TenantTopBar(props: AppTopBarProps) {
  const { active } = useSearchState();
  const onDiscover = usePathname() === DISCOVER_PATH;
  return <AppTopBar {...props} searchField={active && onDiscover ? <TenantSearchField /> : undefined} />;
}
