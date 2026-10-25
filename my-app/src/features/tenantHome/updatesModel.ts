/** Persisted category of a property update. */
export type UpdateCategory = 'important' | 'notice' | 'maintenance';

export type TenantUpdate = {
  id: string;
  title: string;
  message: string;
  category: UpdateCategory;
  /** Milliseconds since epoch of publication. */
  createdMs: number;
  /** Who published it, only when stored. */
  publisher: string | null;
  read: boolean;
};

export type UpdateFilter = 'all' | UpdateCategory;

export const UPDATE_FILTERS: readonly { key: UpdateFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'important', label: 'Important' },
  { key: 'notice', label: 'Notices' },
  { key: 'maintenance', label: 'Maintenance' },
];

export const CATEGORY_LABEL: Record<UpdateCategory, string> = { important: 'Important', notice: 'Notice', maintenance: 'Maintenance' };

/** Newest first. */
export const sortUpdates = (items: readonly TenantUpdate[]): TenantUpdate[] => [...items].sort((a, b) => b.createdMs - a.createdMs);

export const filterUpdates = (items: readonly TenantUpdate[], filter: UpdateFilter): TenantUpdate[] =>
  filter === 'all' ? [...items] : items.filter((u) => u.category === filter);

export const countByFilter = (items: readonly TenantUpdate[], filter: UpdateFilter): number => filterUpdates(items, filter).length;

export const unreadCount = (items: readonly TenantUpdate[]): number => items.filter((u) => !u.read).length;

/** "Just now", "2 hours ago", "Yesterday", else the local date. */
export function formatPosted(ms: number, now: number): string {
  const diff = now - ms;
  const minutes = Math.floor(diff / 60_000);
  if (diff < 0 || minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  if (hours < 48) return 'Yesterday';
  return new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Whether the tenant may read the property's updates now: only from check-in until check-out. A
 * missing check-in date means not yet; a missing check-out date means still staying. The Firestore
 * rules enforce this with the server clock; this only decides what to show.
 */
export type UpdatesAccess = 'open' | 'before' | 'after';

export function updatesAccess(now: number, checkInMs: number | null, checkOutMs: number | null): UpdatesAccess {
  if (checkInMs === null || now < checkInMs) return 'before';
  if (checkOutMs !== null && now > checkOutMs) return 'after';
  return 'open';
}

export const ACCESS_MESSAGE: Record<Exclude<UpdatesAccess, 'open'>, string> = {
  before: 'Updates from your property are available from your check-in date.',
  after: 'Updates from your property are available only during your stay.',
};
