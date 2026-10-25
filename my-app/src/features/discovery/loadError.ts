// Tells apart why a Firestore read failed, so the screen can say the right thing instead of one
// generic "couldn't load", and so an empty list is only ever shown for a query that succeeded.

export type LoadFailure = 'permission-denied' | 'missing-index' | 'network' | 'unknown';

const codeOf = (error: unknown): string => {
  const raw = (error as { code?: unknown } | null)?.code;
  return typeof raw === 'string' ? raw.replace(/^firestore\//, '') : '';
};

export function classifyLoadError(error: unknown): LoadFailure {
  const code = codeOf(error);
  const message = String((error as { message?: unknown } | null)?.message ?? '');
  if (code === 'permission-denied' || code === 'unauthenticated') return 'permission-denied';
  if (code === 'failed-precondition' && /index/i.test(message)) return 'missing-index';
  if (code === 'unavailable' || code === 'deadline-exceeded' || code === 'cancelled') return 'network';
  return 'unknown';
}

export const FAILURE_TEXT: Record<LoadFailure, { title: string; body: string }> = {
  'permission-denied': {
    title: 'Properties aren’t available to you yet',
    body: 'The app isn’t allowed to read the property list right now. Please try again later.',
  },
  'missing-index': { title: 'Search isn’t ready yet', body: 'The property list needs a setup step on our side. Please try again later.' },
  network: { title: 'Couldn’t reach the server', body: 'Check your connection and try again.' },
  unknown: { title: 'Couldn’t load properties', body: 'Something went wrong. Please try again.' },
};

/** Code and message of a Firebase error, for the development log only (never shown to users). */
export function describeLoadError(error: unknown): { code: string; message: string } {
  return { code: codeOf(error) || 'none', message: String((error as { message?: unknown } | null)?.message ?? error).slice(0, 300) };
}
