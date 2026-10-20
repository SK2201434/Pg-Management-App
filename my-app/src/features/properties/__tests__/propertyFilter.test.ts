import { filterByStatus, filterProperties, statusCounts } from '@/features/properties/propertyFilter';
import type { Property } from '@/features/properties/propertyTypes';

const make = (id: string, name: string, location: string | null): Property => ({
  id,
  ownerUid: 'o1',
  name,
  location,
  setupStatus: 'ready',
  status: 'active',
  hasGeo: false,
  coverUrl: null,
});
const list = [make('1', 'Sunrise PG', 'MVP Colony'), make('2', 'Maple Living', null)];

describe('filterProperties', () => {
  it('returns everything for an empty or whitespace query', () => {
    expect(filterProperties(list, '')).toHaveLength(2);
    expect(filterProperties(list, '   ')).toHaveLength(2);
  });

  it('matches name and location, trimmed and case-insensitively', () => {
    expect(filterProperties(list, '  SUNRISE ').map((p) => p.id)).toEqual(['1']);
    expect(filterProperties(list, 'mvp').map((p) => p.id)).toEqual(['1']);
  });

  it('handles properties without a location and no matches', () => {
    expect(filterProperties(list, 'maple').map((p) => p.id)).toEqual(['2']);
    expect(filterProperties(list, 'zzz')).toEqual([]);
  });
});

describe('status filter', () => {
  const mixed = [...list, { ...make('3', 'Old Inn', null), status: 'inactive' as const }];
  it('counts and filters by status', () => {
    expect(statusCounts(mixed)).toEqual({ all: 3, active: 2, inactive: 1 });
    expect(filterByStatus(mixed, 'inactive').map((p) => p.id)).toEqual(['3']);
    expect(filterByStatus(mixed, 'all')).toHaveLength(3);
  });
});
