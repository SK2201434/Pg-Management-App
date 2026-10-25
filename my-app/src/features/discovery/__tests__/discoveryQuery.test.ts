import { getDocs, where } from 'firebase/firestore';

import { classifyLoadError } from '@/features/discovery/loadError';
import { fetchListingsPage } from '@/features/discovery/discoveryService';
import { filterListings, isListable, mergePages } from '@/features/discovery/discoveryModel';
import { listingsKey } from '@/features/discovery/useDiscovery';

jest.mock('@/config/firebase', () => ({ getFirestoreDb: () => ({}) }));
jest.mock('@/features/properties/propertyLocationService', () => ({ claimLocationLocks: jest.fn() }));
jest.mock('@/features/properties/propertyService', () => ({ fetchPropertyRooms: jest.fn() }));
jest.mock('@/store/hooks', () => ({ useAppSelector: jest.fn() }));
jest.mock('@/features/auth/ownerAuthSelectors', () => ({ selectOwner: jest.fn() }));
jest.mock('firebase/firestore', () => ({
  GeoPoint: class {},
  collection: jest.fn((_db: unknown, name: string) => ({ name })),
  deleteDoc: jest.fn(),
  doc: jest.fn(),
  documentId: jest.fn(() => '__name__'),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  limit: jest.fn((n: number) => ({ limit: n })),
  orderBy: jest.fn(),
  query: jest.fn((...args: unknown[]) => args),
  startAfter: jest.fn(),
  serverTimestamp: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  where: jest.fn((f: string, op: string, v: unknown) => ({ f, op, v })),
}));

const docOf = (id: string) => ({ id, data: () => ({ name: `P ${id}`, ownerUid: 'owner1', listed: true }) });
const snapOf = (ids: string[]) => ({ size: ids.length, docs: ids.map(docOf) });

describe('tenant discovery query', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reads the same public listings for any tenant, old or new (no user in the query or key)', async () => {
    (getDocs as jest.Mock).mockResolvedValue(snapOf(['a']));
    const first = await fetchListingsPage(null);
    const second = await fetchListingsPage(null);
    expect(first.items.map((l) => l.id)).toEqual(['a']);
    expect(second).toEqual(first);
    expect(where).toHaveBeenCalledWith('listed', '==', true);
    expect(JSON.stringify(listingsKey)).toBe('["listings"]');
  });

  it('shows a property published after the tenant signed in on the next read', async () => {
    (getDocs as jest.Mock).mockResolvedValueOnce(snapOf([])).mockResolvedValueOnce(snapOf(['new']));
    expect((await fetchListingsPage(null)).items).toEqual([]);
    const refreshed = await fetchListingsPage(null);
    expect(mergePages([refreshed]).map((l) => l.id)).toEqual(['new']);
    expect(filterListings(mergePages([refreshed]), 'p new')).toHaveLength(1);
  });

  it('rejects on a query error instead of returning an empty page', async () => {
    (getDocs as jest.Mock).mockRejectedValue({ code: 'permission-denied' });
    await expect(fetchListingsPage(null)).rejects.toMatchObject({ code: 'permission-denied' });
    expect(classifyLoadError({ code: 'permission-denied' })).toBe('permission-denied');
  });
});

describe('which properties are listed', () => {
  it('lists active, finished properties only', () => {
    expect(isListable({ status: 'active', setupStatus: 'ready' })).toBe(true);
    expect(isListable({ setupStatus: 'ready' })).toBe(true);
    expect(isListable({ status: 'inactive', setupStatus: 'ready' })).toBe(false);
    expect(isListable({ status: 'active', setupStatus: 'draft' })).toBe(false);
  });
});
