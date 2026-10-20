import type { Property } from '@/features/properties/propertyTypes';

/** Case-insensitive match of the trimmed query against property name and location. */
export function filterProperties(properties: readonly Property[], rawQuery: string): Property[] {
  const query = rawQuery.trim().toLowerCase();
  if (query === '') return [...properties];
  return properties.filter(
    (p) => p.name.toLowerCase().includes(query) || (p.location?.toLowerCase().includes(query) ?? false),
  );
}

export type StatusFilter = 'all' | 'active' | 'inactive';

export const filterByStatus = (properties: readonly Property[], filter: StatusFilter): Property[] =>
  filter === 'all' ? [...properties] : properties.filter((p) => p.status === filter);

export function statusCounts(properties: readonly Property[]): Record<StatusFilter, number> {
  const active = properties.filter((p) => p.status === 'active').length;
  return { all: properties.length, active, inactive: properties.length - active };
}

/** The status badge text: an unfinished setup wins, then inactive, else active. */
export function propertyBadge(p: Pick<Property, 'setupStatus' | 'status'>): { label: string; good: boolean } {
  if (p.setupStatus === 'draft') return { label: 'Setup incomplete', good: false };
  return p.status === 'inactive' ? { label: 'Inactive', good: false } : { label: 'Active', good: true };
}
