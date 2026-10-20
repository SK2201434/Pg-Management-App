import { availableBedCount, filterRooms, hasRoomNumber, validateNewRoom, occupancyPercent, parsePropertyId, sortRooms, summarizeRooms } from '@/features/properties/propertyDetailsModel';
import type { PropertyRoom } from '@/features/properties/propertyTypes';

const room = (roomNumber: string, floor: number | null, sharing: number, beds: number): PropertyRoom => ({
  id: roomNumber,
  roomNumber,
  floor,
  sharing,
  ac: false,
  rentPerBedInr: null,
  beds: Array.from({ length: beds }, (_, i) => ({ id: `b${i}`, label: `Bed ${i + 1}`, status: 'available' as const, occupant: null })),
});

describe('parsePropertyId', () => {
  it('accepts ids and the first of an array', () => {
    expect(parsePropertyId('abc123')).toBe('abc123');
    expect(parsePropertyId(['abc123', 'x'])).toBe('abc123');
  });
  it('rejects empty, path-like and non-string values', () => {
    for (const bad of ['', 'a/b', 'a b', undefined, 5, [], 'x'.repeat(129)]) expect(parsePropertyId(bad)).toBeNull();
  });
});

describe('summarizeRooms', () => {
  it('handles a property with no rooms', () => {
    expect(summarizeRooms([])).toEqual({ totalRooms: 0, totalBeds: 0, availableBeds: 0, occupiedBeds: 0, floorCount: 0, incompleteRooms: 0, rent: null });
  });
  it('counts bed records, floors and rooms whose beds do not match', () => {
    const t = summarizeRooms([room('G1', 0, 2, 2), room('101', 1, 3, 1), room('102', 1, 2, 2)]);
    expect(t).toEqual({ totalRooms: 3, totalBeds: 5, availableBeds: 5, occupiedBeds: 0, floorCount: 2, incompleteRooms: 1, rent: null });
  });
});

describe('summarizeRooms rent', () => {
  it('ranges over rooms that have a rent', () => {
    const a = { ...room('1', null, 1, 1), rentPerBedInr: 5000 };
    const b = { ...room('2', null, 1, 1), rentPerBedInr: 8000 };
    expect(summarizeRooms([a, b, room('3', null, 1, 1)]).rent).toEqual({ min: 5000, max: 8000 });
  });
});

describe('sortRooms', () => {
  it('orders by floor then numerically', () => {
    const sorted = sortRooms([room('10', 1, 1, 1), room('2', 1, 1, 1), room('G1', 0, 1, 1)]);
    expect(sorted.map((r) => r.roomNumber)).toEqual(['G1', '2', '10']);
  });
});

describe('occupancyPercent', () => {
  it('is null when occupancy is unknown or there are no beds', () => {
    expect(occupancyPercent(null, 10)).toBeNull();
    expect(occupancyPercent(0, 0)).toBeNull();
  });
  it('rounds and clamps', () => {
    expect(occupancyPercent(1, 3)).toBe(33);
    expect(occupancyPercent(12, 10)).toBe(100);
    expect(occupancyPercent(-1, 10)).toBe(0);
  });
});

describe('availableBeds', () => {
  it('counts only beds with status available', () => {
    const r = room('1', null, 3, 3);
    r.beds[1] = { ...r.beds[1], status: 'unavailable' };
    expect(summarizeRooms([r]).availableBeds).toBe(2);
  });
});

describe('filterRooms', () => {
  const a = room('101', 1, 2, 2);
  const b = room('102', 1, 5, 5);
  b.ac = true;
  b.beds = b.beds.map((x) => ({ ...x, status: 'unavailable' as const }));
  const rooms = [a, b];
  const q = { search: '', filter: 'all' as const, sharing: 'any' as const };
  it('available filter drops rooms with no available bed', () => {
    expect(availableBedCount(b)).toBe(0);
    expect(filterRooms(rooms, { ...q, filter: 'available' })).toEqual([a]);
  });
  it('4+ keeps high-sharing rooms reachable', () => {
    expect(filterRooms(rooms, { ...q, sharing: '4+' })).toEqual([b]);
    expect(filterRooms(rooms, { ...q, sharing: 2 })).toEqual([a]);
  });
  it('searches number, bed label, sharing and AC, case-insensitively, together with filters', () => {
    expect(filterRooms(rooms, { ...q, search: '102' })).toEqual([b]);
    expect(filterRooms(rooms, { ...q, search: 'BED 5' })).toEqual([b]);
    expect(filterRooms(rooms, { ...q, search: '2 sharing' })).toEqual([a]);
    expect(filterRooms(rooms, { ...q, search: 'non-ac' })).toEqual([a]);
    expect(filterRooms(rooms, { ...q, search: '10', filter: 'available' })).toEqual([a]);
  });
});

describe('validateNewRoom', () => {
  const rooms = [room('G1', 0, 2, 2)];
  it('requires a unique number', () => {
    expect(validateNewRoom({ roomNumber: ' ', rent: '', floor: '' }, rooms).roomNumber).toBeDefined();
    expect(validateNewRoom({ roomNumber: 'g1', rent: '', floor: '' }, rooms).roomNumber).toBeDefined();
    expect(hasRoomNumber(rooms, ' G1 ')).toBe(true);
    expect(validateNewRoom({ roomNumber: '101', rent: '', floor: '' }, rooms)).toEqual({});
  });
  it('checks optional rent and floor', () => {
    expect(validateNewRoom({ roomNumber: '1', rent: 'abc', floor: '' }, []).rent).toBeDefined();
    expect(validateNewRoom({ roomNumber: '1', rent: '7500', floor: '61' }, []).floor).toBeDefined();
    expect(validateNewRoom({ roomNumber: '1', rent: '7500', floor: '0' }, [])).toEqual({});
  });
});

describe('occupied beds', () => {
  it('excludes held beds from available and counts them as occupied', () => {
    const r = room('1', null, 3, 3);
    r.beds[0] = { ...r.beds[0], occupant: 'Aarav' };
    expect(availableBedCount(r)).toBe(2);
    expect(summarizeRooms([r])).toMatchObject({ availableBeds: 2, occupiedBeds: 1, totalBeds: 3 });
    expect(filterRooms([r], { search: '', filter: 'occupied', sharing: 'any' })).toEqual([r]);
    expect(filterRooms([room('2', null, 1, 1)], { search: '', filter: 'occupied', sharing: 'any' })).toEqual([]);
  });
});
