import { useLocalSearchParams } from 'expo-router';

import { OwnerIssuesScreen } from '@/features/requests/OwnerIssuesScreen';

// A nested page (outside `(tabs)`): back-arrow header, no bottom navigation. `requestId` puts one issue first.
export default function OwnerIssuesRoute() {
  const { requestId } = useLocalSearchParams<{ requestId?: string }>();
  return <OwnerIssuesScreen focusId={requestId} />;
}
