import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

/**
 * Runs `refetch` each time this screen comes into focus again. The tenant's tabs stay mounted, so a
 * tab the user returns to would otherwise keep showing what it had loaded earlier. The first focus
 * is skipped: the screen has just fetched on mount.
 */
export function useRefetchOnFocus(refetch: () => unknown): void {
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      void refetch();
    }, [refetch]),
  );
}
