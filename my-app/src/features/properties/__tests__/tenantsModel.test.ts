import { activeTenantCount, initials, searchTenants } from '@/features/properties/tenantsModel';
import type { PropertyTenant } from '@/features/properties/propertyTypes';

const t = (name: string, status: PropertyTenant['status'] = 'active'): PropertyTenant => ({
  tenantUid: name,
  name,
  status,
  joinedAtMs: null,
  source: 'joined',
  roomNumber: null,
  bedLabel: null,
  sharing: null,
  rentInr: null,
});

describe('tenantsModel', () => {
  it('builds initials', () => {
    expect(initials('Aarav Sharma')).toBe('AS');
    expect(initials('priya')).toBe('P');
    expect(initials('  ')).toBe('?');
  });
  it('searches names case-insensitively', () => {
    const list = [t('Aarav Sharma'), t('Priya Nair')];
    expect(searchTenants(list, ' NAIR ').map((x) => x.name)).toEqual(['Priya Nair']);
    expect(searchTenants(list, '')).toHaveLength(2);
  });
  it('counts active tenants only', () => {
    expect(activeTenantCount([t('a'), t('b', 'inactive')])).toBe(1);
  });
});
