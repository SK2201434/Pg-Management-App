import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { selectOwner } from '@/features/auth/ownerAuthSelectors';
import { fetchReadIds, saveReadIds } from '@/features/notifications/notificationService';
import { useAppSelector } from '@/store/hooks';

// Same store and cache key as the owner's read marks (`users/{uid}/notificationReads`): the key
// carries the uid, so one account's marks are never shown for another.
const readsKey = (uid: string | undefined) => ['notificationReads', uid] as const;

/** The signed-in user's read marks, and a mutation that adds to them (the cache updates at once). */
export function useReadMarks() {
  const uid = useAppSelector(selectOwner)?.uid;
  const queryClient = useQueryClient();
  const reads = useQuery({ queryKey: readsKey(uid), queryFn: () => fetchReadIds(uid as string), enabled: uid !== undefined });
  const mark = useMutation<boolean, Error, string[]>({
    mutationFn: (ids) => saveReadIds(uid as string, ids),
    onMutate: (ids) => {
      queryClient.setQueryData<string[]>(readsKey(uid), (old) => [...new Set([...(old ?? []), ...ids])]);
    },
  });
  return { reads, mark };
}
