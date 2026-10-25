import { useQuery, useQueryClient } from '@tanstack/react-query';

import { myStayRequestsLiveKey } from '@/features/discovery/stayRequestKeys';
import { loadStoredStayRequests } from '@/features/discovery/myStayRequestsStore';
import type { LiveMyStayRequests } from '@/features/discovery/myStayRequestsLive';
import { selectOwner } from '@/features/auth/ownerAuthSelectors';
import { fetchTenantStay } from '@/features/tenantHome/tenantHomeService';
import { useAppSelector } from '@/store/hooks';

export const tenantStayKey = (uid: string | undefined) => ['tenantStay', uid] as const;

/** The signed-in tenant's current stay, cached per uid. */
export function useTenantStay() {
  const uid = useAppSelector(selectOwner)?.uid;
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: tenantStayKey(uid),
    queryFn: async () => {
      // The properties this tenant has asked to stay at, so their membership is found even where the
      // collection-group lookup is unavailable.
      const shown = queryClient.getQueryData<LiveMyStayRequests>(myStayRequestsLiveKey(uid))?.items ?? [];
      const stored = await loadStoredStayRequests(uid as string);
      return fetchTenantStay(uid as string, [...new Set([...shown, ...stored].map((r) => r.propertyId))]);
    },
    enabled: uid !== undefined,
    retry: false,
    // The app-wide default keeps data fresh for 5 minutes, which would show "no stay" for minutes
    // after an owner approves a request. The stay is one small read, so it is always re-read.
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
  });
}
