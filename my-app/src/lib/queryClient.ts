import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform, type AppStateStatus } from 'react-native';

const STALE_TIME_MS = 5 * 60 * 1000;
const GC_TIME_MS = 30 * 60 * 1000;
const MAX_QUERY_RETRIES = 2;

// Firebase (`FirebaseError.code`) failures that a retry cannot fix.
const PERMANENT_FIREBASE_CODES = new Set([
  'permission-denied',
  'unauthenticated',
  'invalid-argument',
  'not-found',
  'already-exists',
  'failed-precondition',
  'out-of-range',
  'unimplemented',
]);

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  // Covers NormalizedApiError (`status`) and raw Axios errors (`response.status`).
  const { status, response } = error as { status?: unknown; response?: { status?: unknown } };
  const value = typeof status === 'number' ? status : response?.status;
  return typeof value === 'number' ? value : undefined;
}

function getFirebaseCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const { code } = error as { code?: unknown };
  return typeof code === 'string' ? code.replace(/^[^/]+\//, '') : undefined;
}

/** Permanent failures (4xx except 408/429, or a non-retryable Firebase code) are not retried. */
export function isRetryableError(error: unknown): boolean {
  const status = getErrorStatus(error);
  if (status !== undefined && status >= 400 && status < 500) {
    return status === 408 || status === 429;
  }
  const code = getFirebaseCode(error);
  return code === undefined || !PERMANENT_FIREBASE_CODES.has(code);
}

// React Native has no window focus events; report app foreground/background to TanStack Query
// instead. `setEventListener` runs the setup once at module load (replacing any previous
// listener, so hot reloads do not stack subscriptions). The cleanup runs when the last query
// observer unsubscribes, and the stored setup is re-run on the next subscribe.
if (Platform.OS !== 'web') {
  focusManager.setEventListener((handleFocus) => {
    const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
      handleFocus(status === 'active');
    });
    return () => subscription.remove();
  });
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is fresh for 5 minutes: remounts and foregrounding inside that window cost no reads.
      staleTime: STALE_TIME_MS,
      // Unused data is dropped after 30 minutes (must be >= staleTime).
      gcTime: GC_TIME_MS,
      retry: (failureCount, error) => failureCount < MAX_QUERY_RETRIES && isRetryableError(error),
      // Only stale queries refetch when the app returns to the foreground.
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    // Mutations are not safe to repeat automatically.
    mutations: { retry: false },
  },
});
