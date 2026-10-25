import AsyncStorage from '@react-native-async-storage/async-storage';

import { STAY_REQUEST_STATUSES } from '@/features/discovery/discoveryModel';
import type { MyStayRequest } from '@/features/tenantNotifications/tenantNotificationsModel';

// The tenant's last known stay requests, kept on the device per account so they are on screen the
// moment the app reloads, before (or without) the live listener answering. The server copy always
// replaces it. Storage trouble is never fatal: it just means nothing is remembered.
const storageKey = (uid: string) => `hostell.myStayRequests.v1.${uid}`;

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export async function loadStoredStayRequests(uid: string): Promise<MyStayRequest[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(uid));
    const list: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    return list.flatMap((r): MyStayRequest[] => {
      const status = STAY_REQUEST_STATUSES.find((s) => s === r?.status);
      return typeof r?.propertyId === 'string' && status
        ? [{ propertyId: r.propertyId, status, message: typeof r.message === 'string' ? r.message : null, createdMs: num(r.createdMs), updatedMs: num(r.updatedMs) }]
        : [];
    });
  } catch {
    return [];
  }
}

export async function saveStoredStayRequests(uid: string, items: readonly MyStayRequest[]): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(uid), JSON.stringify(items));
  } catch {
    // Not remembered this time.
  }
}
