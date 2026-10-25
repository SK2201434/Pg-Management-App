import { updatesAccess, countByFilter, filterUpdates, formatPosted, sortUpdates, unreadCount, type TenantUpdate } from '@/features/tenantHome/updatesModel';

const u = (id: string, category: TenantUpdate['category'], createdMs: number, read = false): TenantUpdate => ({ id, title: id, message: '', category, createdMs, publisher: null, read });
const items = [u('a', 'notice', 1), u('b', 'important', 3, true), u('c', 'notice', 2)];

describe('updates model', () => {
  it('sorts newest first and filters by category', () => {
    expect(sortUpdates(items).map((x) => x.id)).toEqual(['b', 'c', 'a']);
    expect(filterUpdates(items, 'notice').map((x) => x.id)).toEqual(['a', 'c']);
    expect(filterUpdates(items, 'maintenance')).toEqual([]);
    expect(countByFilter(items, 'all')).toBe(3);
  });
  it('counts unread', () => {
    expect(unreadCount(items)).toBe(2);
  });
  it('formats relative time', () => {
    const now = new Date(2024, 9, 15, 12).getTime();
    expect(formatPosted(now - 30_000, now)).toBe('Just now');
    expect(formatPosted(now - 2 * 3_600_000, now)).toBe('2 hours ago');
    expect(formatPosted(now - 30 * 3_600_000, now)).toBe('Yesterday');
    expect(formatPosted(now - 5 * 86_400_000, now)).toMatch(/2024/);
  });
  it('opens updates only between check-in and check-out', () => {
    expect(updatesAccess(10, null, null)).toBe('before');
    expect(updatesAccess(10, 20, null)).toBe('before');
    expect(updatesAccess(20, 20, null)).toBe('open');
    expect(updatesAccess(30, 20, 40)).toBe('open');
    expect(updatesAccess(41, 20, 40)).toBe('after');
  });
});
