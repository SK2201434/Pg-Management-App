import { buildMatches, buildPhoneMatchNotifications, declinedMatches, dismissKey, placementOf, type UnlinkedResident } from '@/features/phoneMatch/phoneMatchModel';

const resident = (over: Partial<UnlinkedResident> = {}): UnlinkedResident => ({
  propertyId: 'p1', propertyName: 'Sunrise PG', residentId: 'res1', name: 'Rahul', phone: '9876543210', roomNumber: '101', bedLabel: 'Bed 2', ...over,
});
const accounts = (phone: string, ...uids: string[]) => new Map([[phone, uids.map((uid) => ({ uid, displayName: `Name ${uid}` }))]]);

describe('buildMatches', () => {
  it('pairs a resident with the registered account that shares their number', () => {
    const [m] = buildMatches([resident()], accounts('9876543210', 't1'), new Map(), new Set());
    expect(m).toMatchObject({ id: 'p1_res1_t1', residentName: 'Rahul', tenantUid: 't1', tenantName: 'Name t1', phone: '9876543210' });
  });

  it('suggests nothing when nobody registered with the number', () => {
    expect(buildMatches([resident()], accounts('9000000000', 't1'), new Map(), new Set())).toEqual([]);
    expect(buildMatches([resident()], new Map(), new Map(), new Set())).toEqual([]);
  });

  it('gives each account on a shared number its own suggestion', () => {
    const list = buildMatches([resident()], accounts('9876543210', 't1', 't2'), new Map(), new Set());
    expect(list.map((m) => m.tenantUid)).toEqual(['t1', 't2']);
  });

  it('leaves out accounts already members of that property and ones the owner dismissed', () => {
    const members = new Map([['p1', new Set(['t1'])]]);
    const dismissed = new Set([dismissKey('res1', 't2')]);
    expect(buildMatches([resident()], accounts('9876543210', 't1', 't2', 't3'), members, dismissed).map((m) => m.tenantUid)).toEqual(['t3']);
  });

  it('keeps a dismissal to its own resident and account, and a membership to its own property', () => {
    const other = resident({ propertyId: 'p2', propertyName: 'Other', residentId: 'res2' });
    const members = new Map([['p1', new Set(['t1'])]]);
    const dismissed = new Set([dismissKey('res1', 't1')]);
    const list = buildMatches([resident(), other], accounts('9876543210', 't1'), members, dismissed);
    expect(list.map((m) => m.id)).toEqual(['p2_res2_t1']);
  });
});

describe('notifications and labels', () => {
  const [m] = buildMatches([resident()], accounts('9876543210', 't1'), new Map(), new Set());
  it('describes the match with the placement', () => {
    expect(placementOf(m)).toBe('Room 101 · Bed 2');
    expect(placementOf({ roomNumber: null, bedLabel: null })).toBeNull();
    expect(placementOf({ roomNumber: '7', bedLabel: null })).toBe('Room 7');
  });
  it('makes one stable notification per suggestion', () => {
    const [n] = buildPhoneMatchNotifications([m], 1000);
    expect(n).toMatchObject({ id: 'phone-match_p1_res1_t1', kind: 'phone-match', tenantUid: 't1', propertyId: 'p1', atMs: 1000 });
    expect(n.body).toContain('Name t1');
    expect(n.body).toContain('Rahul');
    expect(n.body).toContain('Room 101');
  });
});

describe('a tenant who says the number is not theirs', () => {
  const declined = new Set([dismissKey('res1', 't1')]);
  const list = buildMatches([resident()], accounts('9876543210', 't1', 't2'), new Map(), new Set(), declined);

  it('marks only that resident and account as declined', () => {
    expect(list.map((m) => [m.tenantUid, m.declined])).toEqual([['t1', true], ['t2', false]]);
    expect(declinedMatches(list).map((m) => m.tenantUid)).toEqual(['t1']);
  });

  it('is not hidden by being dismissed elsewhere, and stays until the owner resolves it', () => {
    expect(buildMatches([resident()], accounts('9876543210', 't1'), new Map(), new Set(), declined)).toHaveLength(1);
    // Correcting the number moves the resident to another phone, which has no such account: nothing is left.
    expect(buildMatches([resident({ phone: '9111111111' })], accounts('9876543210', 't1'), new Map(), new Set(), declined)).toEqual([]);
  });

  it('asks the owner to verify the details, naming the tenant, property and bed', () => {
    const [n1, n2] = buildPhoneMatchNotifications(list, 1000);
    expect(n1).toMatchObject({ id: 'phone-declined_p1_res1_t1', kind: 'phone-declined', residentId: 'res1' });
    expect(n1.body).toContain('Name t1');
    expect(n1.body).toContain('Sunrise PG');
    expect(n1.body).toContain('Room 101 · Bed 2');
    expect(n1.body).toMatch(/correct the number or unassign the bed/i);
    expect(n2.kind).toBe('phone-match');
  });
});
