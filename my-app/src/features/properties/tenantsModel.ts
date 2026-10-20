// Pure helpers for the property Tenants screen. No React, no Firebase.
import type { PropertyTenant } from '@/features/properties/propertyTypes';

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/** Case-insensitive match of the trimmed query against the tenant's name. */
export function searchTenants(tenants: readonly PropertyTenant[], rawQuery: string): PropertyTenant[] {
  const query = rawQuery.trim().toLowerCase();
  return query === '' ? [...tenants] : tenants.filter((t) => t.name.toLowerCase().includes(query));
}

export const activeTenantCount = (tenants: readonly PropertyTenant[]) =>
  tenants.filter((t) => t.status === 'active').length;

export function formatJoined(ms: number | null): string | null {
  if (ms === null) return null;
  return new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
