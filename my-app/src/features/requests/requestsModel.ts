import type { ComponentProps } from 'react';
import type { MyStayRequestView } from '@/features/discovery/useMyStayRequestViews';
import type MaterialIcons from '@expo/vector-icons/MaterialIcons';

/** Persisted `status` of `properties/{pid}/requests/{id}`. Written `open` by the tenant; the owner moves it on. */
export type RequestStatus = 'open' | 'in_progress' | 'resolved';

/** Persisted `category`. The Firestore rules accept exactly these values. */
export type RequestCategory = 'wifi' | 'plumbing' | 'electrical' | 'furniture' | 'cleaning' | 'other';

export type TenantRequest = {
  id: string;
  category: RequestCategory;
  title: string;
  description: string;
  status: RequestStatus;
  createdMs: number | null;
  /** Last change by the owner (status), when stored. */
  updatedMs: number | null;
};

/** Either kind of request the tenant has made, so Home and Requests can list them together. */
export type CombinedRequest =
  | { kind: 'stay'; key: string; sortMs: number; request: MyStayRequestView }
  | { kind: 'maintenance'; key: string; sortMs: number; request: TenantRequest };

// A request whose server timestamp has not arrived yet was just made, so it counts as newest.
const NEWEST = Number.MAX_SAFE_INTEGER;

/** Stay requests and maintenance tickets in one list, the most recently changed first. */
export function combineRequests(stay: readonly MyStayRequestView[], maintenance: readonly TenantRequest[]): CombinedRequest[] {
  const all: CombinedRequest[] = [
    ...stay.map((request): CombinedRequest => ({ kind: 'stay', key: `stay:${request.propertyId}`, sortMs: request.updatedMs ?? request.createdMs ?? NEWEST, request })),
    ...maintenance.map((request): CombinedRequest => ({ kind: 'maintenance', key: `ticket:${request.id}`, sortMs: request.updatedMs ?? request.createdMs ?? NEWEST, request })),
  ];
  return all.sort((a, b) => b.sortMs - a.sortMs);
}

type IconName = ComponentProps<typeof MaterialIcons>['name'];

export const CATEGORIES: readonly { key: RequestCategory; label: string; icon: IconName }[] = [
  { key: 'wifi', label: 'Wi-Fi', icon: 'wifi' },
  { key: 'plumbing', label: 'Plumbing', icon: 'water-drop' },
  { key: 'electrical', label: 'Electrical', icon: 'lightbulb' },
  { key: 'furniture', label: 'Furniture', icon: 'chair' },
  { key: 'cleaning', label: 'Cleaning', icon: 'cleaning-services' },
  { key: 'other', label: 'Other', icon: 'build' },
];

export const categoryOf = (key: RequestCategory) => CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[CATEGORIES.length - 1];

export const isCategory = (v: unknown): v is RequestCategory => CATEGORIES.some((c) => c.key === v);

/** A status this version does not know is shown as `open` rather than hidden. */
export const toStatus = (v: unknown): RequestStatus => (v === 'in_progress' || v === 'resolved' ? v : 'open');

export type StatusFilter = 'all' | RequestStatus;

export const STATUS_FILTERS: readonly { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved' },
];

export const STATUS_LABEL: Record<RequestStatus, string> = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved' };

export const filterRequests = (items: readonly TenantRequest[], filter: StatusFilter): TenantRequest[] =>
  filter === 'all' ? [...items] : items.filter((r) => r.status === filter);

export const countRequests = (items: readonly TenantRequest[], filter: StatusFilter): number => filterRequests(items, filter).length;

/** Requests still being worked on: everything not resolved. */
export const activeCount = (items: readonly TenantRequest[]): number => items.filter((r) => r.status !== 'resolved').length;

/** Newest first; requests whose server timestamp has not arrived yet count as newest. */
export const sortRequests = (items: readonly TenantRequest[]): TenantRequest[] =>
  [...items].sort((a, b) => (b.createdMs ?? Number.MAX_SAFE_INTEGER) - (a.createdMs ?? Number.MAX_SAFE_INTEGER));

/** A short reference derived from the real document id. */
export const ticketRef = (id: string): string => `#${id.slice(0, 6).toUpperCase()}`;

export const formatSubmitted = (ms: number | null): string | null =>
  ms === null ? null : `Submitted ${new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;

export const TITLE_MAX = 100;
export const DESCRIPTION_MAX = 1000;

export type NewRequestInput = { category: RequestCategory | null; title: string; description: string };
export type RequestErrors = { category?: string; title?: string; description?: string };

export function validateRequest(input: NewRequestInput): RequestErrors {
  const errors: RequestErrors = {};
  if (input.category === null) errors.category = 'Choose a category.';
  const title = input.title.trim();
  if (title.length < 3) errors.title = 'Enter a short title (at least 3 characters).';
  else if (title.length > TITLE_MAX) errors.title = `Keep the title under ${TITLE_MAX} characters.`;
  const description = input.description.trim();
  if (description.length < 10) errors.description = 'Describe the problem (at least 10 characters).';
  else if (description.length > DESCRIPTION_MAX) errors.description = `Keep the description under ${DESCRIPTION_MAX} characters.`;
  return errors;
}
