import { buildStayRequestNotifications, pendingCount, sortStayRequests, type OwnerStayRequest } from '@/features/stayRequests/stayRequestsModel';

const req = (tenantUid: string, status: OwnerStayRequest['status'], updatedMs: number | null, message: string | null = null): OwnerStayRequest => ({
  propertyId: 'p1', propertyName: 'Green PG', tenantUid, tenantName: `Name ${tenantUid}`, tenantPhone: null, tenantGender: null, tenantEmail: null, message, status, createdMs: updatedMs, updatedMs,
});

describe('stay request notifications', () => {
  it('makes one notification per pending request, newest first, and none for decided ones', () => {
    const out = buildStayRequestNotifications([req('a', 'pending', 10), req('b', 'approved', 20), req('c', 'pending', 30), req('d', 'withdrawn', 40)], 99);
    expect(out.map((n) => n.tenantUid)).toEqual(['c', 'a']);
    expect(out[0]).toMatchObject({ kind: 'stay-request', title: 'New stay request', propertyId: 'p1', propertyName: 'Green PG', atMs: 30 });
    expect(out[0].body).toBe('Name c wants to stay at Green PG.');
  });

  it('gives a request sent again a new id, and the same request the same id', () => {
    const first = buildStayRequestNotifications([req('a', 'pending', 10)], 0)[0].id;
    expect(buildStayRequestNotifications([req('a', 'pending', 10)], 5)[0].id).toBe(first);
    expect(buildStayRequestNotifications([req('a', 'pending', 50)], 0)[0].id).not.toBe(first);
  });

  it('includes a trimmed message and copes with a server time that has not arrived', () => {
    const long = 'x'.repeat(200);
    const [n] = buildStayRequestNotifications([req('a', 'pending', null, long)], 777);
    expect(n.body.length).toBeLessThan(140);
    expect(n.body).toContain('…');
    expect(n.atMs).toBe(777);
  });

  it('lists pending requests first', () => {
    const sorted = sortStayRequests([req('a', 'approved', 50), req('b', 'pending', 10), req('c', 'pending', 20)]);
    expect(sorted.map((r) => r.tenantUid)).toEqual(['c', 'b', 'a']);
    expect(pendingCount(sorted)).toBe(2);
  });
});
