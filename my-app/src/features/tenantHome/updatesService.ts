import { collection, getDocs } from 'firebase/firestore';

import { getFirestoreDb } from '@/config/firebase';
import type { TenantUpdate, UpdateCategory } from '@/features/tenantHome/updatesModel';

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const isCategory = (v: unknown): v is UpdateCategory => v === 'important' || v === 'notice' || v === 'maintenance';

/**
 * The property's updates. The rules let a tenant read them only from check-in to check-out, so this
 * is called only inside that window; outside it the read is denied by the server. `read` is applied
 * by the caller from the tenant's own read marks.
 */
export async function fetchPropertyUpdates(propertyId: string): Promise<Omit<TenantUpdate, 'read'>[]> {
  const snap = await getDocs(collection(getFirestoreDb(), 'properties', propertyId, 'updates'));
  return snap.docs.flatMap((d) => {
    const data = d.data();
    const title = text(data.title);
    const created = data.createdAt as { toMillis?: () => number } | null | undefined;
    if (title === null || !isCategory(data.category) || typeof created?.toMillis !== 'function') return [];
    return [{ id: d.id, title, message: text(data.message) ?? '', category: data.category, createdMs: created.toMillis(), publisher: text(data.publisher) }];
  });
}
