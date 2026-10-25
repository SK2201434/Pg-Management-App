import { DiscoverScreen } from '@/features/discovery/DiscoverScreen';

// A nested page (outside `(tabs)`): back-arrow header, no bottom navigation. The top bar's search
// field controls this screen.
export default function TenantDiscoverRoute() {
  return <DiscoverScreen />;
}
