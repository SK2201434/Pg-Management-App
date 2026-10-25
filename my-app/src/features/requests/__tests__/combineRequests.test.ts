import { combineRequests, type TenantRequest } from '@/features/requests/requestsModel';
import type { MyStayRequestView } from '@/features/discovery/useMyStayRequestViews';

const stay = (propertyId: string, updatedMs: number | null, createdMs: number | null = updatedMs): MyStayRequestView => ({ propertyId, status: 'pending', message: null, createdMs, updatedMs, propertyName: null });
const ticket = (id: string, createdMs: number | null, updatedMs: number | null = null): TenantRequest => ({ id, category: 'wifi', title: id, description: '', status: 'open', createdMs, updatedMs });

describe('combineRequests', () => {
  it('lists stay requests and tickets together, latest change first', () => {
    const out = combineRequests([stay('p1', 100), stay('p2', 300)], [ticket('t1', 200), ticket('t2', 50, 400)]);
    expect(out.map((c) => c.key)).toEqual(['ticket:t2', 'stay:p2', 'ticket:t1', 'stay:p1']);
  });
  it('puts a request still waiting for its server timestamp first', () => {
    expect(combineRequests([stay('p1', null, null)], [ticket('t1', 999)])[0].key).toBe('stay:p1');
  });
});
