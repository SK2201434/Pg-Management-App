import { buildStayDecisionNotifications, buildTenantNotifications, sortMyStayRequests } from '@/features/tenantNotifications/tenantNotificationsModel';
import type { TenantRequest } from '@/features/requests/requestsModel';
import type { TenantUpdate } from '@/features/tenantHome/updatesModel';

const req = (id: string, status: TenantRequest['status'], createdMs: number, updatedMs: number | null): TenantRequest => ({ id, category: 'wifi', title: `T${id}`, description: '', status, createdMs, updatedMs });
const upd = (id: string, category: TenantUpdate['category'], createdMs: number): TenantUpdate => ({ id, title: `U${id}`, message: 'm', category, createdMs, publisher: null, read: false });

describe('tenant notifications model', () => {
  const list = buildTenantNotifications({
    propertyId: 'p1',
    propertyName: 'P',
    requests: [req('a', 'open', 10, 10), req('b', 'resolved', 5, 40)],
    updates: [upd('x', 'important', 30), upd('y', 'notice', 20)],
  });
  it('derives stable ids from the record and its status', () => {
    expect(list.map((n) => n.id)).toEqual(['req_p1_b_resolved', 'upd_p1_x', 'upd_p1_y']);
  });
  it('does not notify the tenant about a request they just raised', () => {
    expect(list.some((n) => n.kind === 'request-open')).toBe(false);
  });
  it('uses the status change time and maps kinds and targets', () => {
    expect(list[0]).toMatchObject({ kind: 'request-resolved', atMs: 40, target: 'requests' });
    expect(list[1]).toMatchObject({ kind: 'announcement-important', target: 'updates' });
  });
  it('yields nothing when there is nothing', () => {
    expect(buildTenantNotifications({ propertyId: 'p', propertyName: 'P', requests: [], updates: [] })).toEqual([]);
  });

  it('notifies the tenant once when the owner decides a stay request', () => {
    const names = new Map([['p1', 'Green PG']]);
    const out = buildStayDecisionNotifications(
      [
        { propertyId: 'p1', status: 'approved', message: null, createdMs: 1, updatedMs: 50 },
        { propertyId: 'p2', status: 'rejected', message: null, createdMs: 1, updatedMs: 60 },
        { propertyId: 'p3', status: 'pending', message: null, createdMs: 1, updatedMs: 70 },
        { propertyId: 'p4', status: 'withdrawn', message: null, createdMs: 1, updatedMs: 80 },
      ],
      names,
    );
    expect(out.map((n) => n.kind)).toEqual(['stay-approved', 'stay-declined']);
    expect(out[0]).toMatchObject({ title: 'Stay request approved', propertyName: 'Green PG', target: 'property', atMs: 50, id: 'stay-decision_p1_approved_50' });
    expect(out[0].body).toContain('Green PG');
    expect(out[1].body).toContain('the property'); // name not known yet
  });
});

describe('my stay requests order', () => {
  it('lists the most recently changed first', () => {
    const r = (propertyId: string, updatedMs: number | null) => ({ propertyId, status: 'pending' as const, message: null, createdMs: updatedMs, updatedMs });
    expect(sortMyStayRequests([r('a', 10), r('b', 30), r('c', null)]).map((x) => x.propertyId)).toEqual(['c', 'b', 'a']);
  });
});
