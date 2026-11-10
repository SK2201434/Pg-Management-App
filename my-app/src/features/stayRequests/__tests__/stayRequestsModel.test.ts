import { buildStayRequestNotifications, pendingCount, sortStayRequests, type OwnerStayRequest } from '@/features/stayRequests/stayRequestsModel';

const req = (tenantUid: string, status: OwnerStayRequest['status'], updatedMs: number | null, message: string | null = null, createdMs: number | null = updatedMs): OwnerStayRequest => ({
  propertyId: 'p1', propertyName: 'Green PG', tenantUid, tenantName: `Name ${tenantUid}`, tenantPhone: null, tenantGender: null, tenantEmail: null, message, status, createdMs, updatedMs,
});

describe('stay request notifications', () => {
  it('keeps one notification per request whatever its status, newest first', () => {
    const out = buildStayRequestNotifications([req('a', 'pending', 10), req('b', 'approved', 20), req('c', 'pending', 30), req('d', 'withdrawn', 40), req('e', 'rejected', 50)], 99);
    expect(out.map((n) => n.tenantUid)).toEqual(['e', 'd', 'c', 'b', 'a']);
    expect(out.find((n) => n.tenantUid === 'c')).toMatchObject({ kind: 'stay-request', title: 'New stay request', propertyId: 'p1', propertyName: 'Green PG', atMs: 30 });
    expect(out.find((n) => n.tenantUid === 'c')?.body).toBe('Name c wants to stay at Green PG.');
  });

  it('does not lose the notification when the owner declines or approves the request', () => {
    const pending = buildStayRequestNotifications([req('a', 'pending', 10)], 0)[0];
    const declined = buildStayRequestNotifications([req('a', 'rejected', 5_000_000, null, 10)], 0)[0];
    const approved = buildStayRequestNotifications([req('a', 'approved', 6_000_000, null, 10)], 0)[0];
    expect(declined.id).toBe(pending.id);
    expect(approved.id).toBe(pending.id);
    expect(declined).toMatchObject({ title: 'Stay request declined', body: 'You declined Name a’s request to stay at Green PG.', autoRead: true });
    expect(approved).toMatchObject({ title: 'Stay request approved', autoRead: true });
    // A tenant withdrawing is news to the owner, so it is not auto-read.
    expect(buildStayRequestNotifications([req('a', 'withdrawn', 7_000_000, null, 10)], 0)[0]).toMatchObject({ title: 'Stay request withdrawn' });
    expect(buildStayRequestNotifications([req('a', 'withdrawn', 7_000_000, null, 10)], 0)[0].autoRead).toBeUndefined();
  });

  it('gives a request sent again a new id, and the same request the same id', () => {
    const first = buildStayRequestNotifications([req('a', 'pending', 10)], 0)[0].id;
    expect(buildStayRequestNotifications([req('a', 'pending', 10)], 5)[0].id).toBe(first);
    // Same document, created at 10, sent again much later: a new notification, so it shows as unread.
    expect(buildStayRequestNotifications([req('a', 'pending', 9_000_000, null, 10)], 0)[0].id).not.toBe(first);
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
