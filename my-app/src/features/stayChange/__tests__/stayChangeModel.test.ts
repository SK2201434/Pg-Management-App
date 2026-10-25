import { canApply, canChangeStay, canPropose, freeBedChoices, stayLabel } from '@/features/stayChange/stayChangeModel';
import type { PropertyRoom } from '@/features/properties/propertyTypes';

const room = (id: string, roomNumber: string, beds: PropertyRoom['beds'], rent: number | null = 5000): PropertyRoom => ({ id, roomNumber, floor: null, sharing: beds.length, ac: false, rentPerBedInr: rent, beds });
const bed = (id: string, label: string, status: 'available' | 'unavailable' = 'available', occupant: string | null = null) => ({ id, label, status, occupant });

describe('stay change', () => {
  it('offers only free beds, never the tenant’s current one', () => {
    const rooms = [
      room('r1', '101', [bed('b1', 'A'), bed('b2', 'B', 'available', 'Ravi'), bed('b3', 'C', 'unavailable')]),
      room('r2', '102', [bed('b4', 'A'), bed('b5', 'B')], 6500),
    ];
    const choices = freeBedChoices(rooms, 'b1');
    expect(choices.map((c) => c.bedId)).toEqual(['b4', 'b5']);
    expect(choices[0]).toMatchObject({ roomId: 'r2', roomNumber: '102', bedLabel: 'A', sharing: 2, rentInr: 6500 });
    expect(freeBedChoices(rooms, null).map((c) => c.bedId)).toEqual(['b1', 'b4', 'b5']);
    expect(freeBedChoices([], null)).toEqual([]);
  });

  it('lets the owner propose again only after a finished proposal', () => {
    expect(canPropose(null)).toBe(true);
    expect(canPropose({ status: 'declined' })).toBe(true);
    expect(canPropose({ status: 'cancelled' })).toBe(true);
    expect(canPropose({ status: 'applied' })).toBe(true);
    expect(canPropose({ status: 'pending' })).toBe(false);
    expect(canPropose({ status: 'accepted' })).toBe(false);
  });

  it('applies only an accepted proposal', () => {
    expect(canApply({ status: 'accepted' })).toBe(true);
    expect(canApply({ status: 'pending' })).toBe(false);
    expect(canApply({ status: 'declined' })).toBe(false);
    expect(canApply(null)).toBe(false);
  });

  it('needs a tenant with an app account and a current stay', () => {
    expect(canChangeStay({ source: 'added', accountUid: 'u1', roomNumber: '101' })).toBe(true);
    expect(canChangeStay({ source: 'added', roomNumber: '101' })).toBe(false);
    expect(canChangeStay({ source: 'added', accountUid: 'u1', roomNumber: null })).toBe(false);
    expect(canChangeStay({ source: 'joined', accountUid: 'u1', roomNumber: null })).toBe(false);
  });

  it('labels a room and bed', () => {
    expect(stayLabel('204', 'B')).toBe('Room 204 · Bed B');
    expect(stayLabel('204', null)).toBe('Room 204');
  });
});
