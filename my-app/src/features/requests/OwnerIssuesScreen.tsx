import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { BrandColors } from '@/constants/theme';
import { useOwnerPropertyData } from '@/features/dashboard/useOwnerPropertyData';
import type { OwnerTenantRequest } from '@/features/notifications/notificationsModel';
import { useOwnerTenantRequests } from '@/features/requests/ownerRequestsLive';
import { STATUS_FILTERS, STATUS_LABEL, categoryOf, formatSubmitted, ticketRef, type RequestStatus, type StatusFilter } from '@/features/requests/requestsModel';
import { updateRequestStatus } from '@/features/requests/requestsService';

const NEWEST = Number.MAX_SAFE_INTEGER;

// Tenants' issues, for the owner: the whole issue, and the buttons that move it along. They update
// live; the tenant is notified of each status change.
export function OwnerIssuesScreen({ focusId }: { focusId?: string }) {
  const all = useOwnerTenantRequests();
  const propertyData = useOwnerPropertyData();
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const names = new Map(propertyData.data.flatMap((p) => (p.tenants ?? []).map((t) => [t.tenantUid, t.name] as const)));
  const items = all
    .filter((r) => filter === 'all' || r.status === filter)
    // The issue that was tapped comes first, then newest first.
    .sort((a, b) => Number(b.id === focusId) - Number(a.id === focusId) || (b.createdMs ?? NEWEST) - (a.createdMs ?? NEWEST));
  const count = (f: StatusFilter) => (f === 'all' ? all.length : all.filter((r) => r.status === f).length);
  const active = all.filter((r) => r.status !== 'resolved').length;

  const setStatus = async (r: OwnerTenantRequest, status: RequestStatus) => {
    setBusyId(r.id);
    setError(null);
    try {
      await updateRequestStatus(r.propertyId, r.id, status);
    } catch {
      setError('Could not update the issue. Check your connection and try again.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Tenant issues', headerTitle: active > 0 ? `${active} active` : '' }} />
      <View style={styles.filters}>
        {STATUS_FILTERS.map((f) => (
          <Pressable
            key={f.key}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === f.key }}
            onPress={() => setFilter(f.key)}
            style={[styles.chip, filter === f.key && styles.chipOn]}>
            <Text style={[styles.chipText, filter === f.key && styles.chipTextOn]}>{f.label} {count(f.key)}</Text>
          </Pressable>
        ))}
      </View>
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(r) => `${r.propertyId}_${r.id}`}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialIcons name="build" size={32} color={BrandColors.textSecondary} />
            <Text style={styles.title}>{all.length === 0 ? 'No issues yet' : 'Nothing here'}</Text>
            <Text style={styles.muted}>{all.length === 0 ? 'When a tenant raises an issue, it appears here at once.' : 'No issues with this status.'}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <IssueCard item={item} tenantName={names.get(item.tenantUid) ?? 'A tenant'} busy={busyId === item.id} onSetStatus={(s) => void setStatus(item, s)} />
        )}
      />
    </View>
  );
}

function IssueCard({ item: r, tenantName, busy, onSetStatus }: { item: OwnerTenantRequest; tenantName: string; busy: boolean; onSetStatus: (s: RequestStatus) => void }) {
  const category = categoryOf(r.category);
  return (
    <View style={[styles.card, r.status === 'open' && styles.cardOpen]}>
      <View style={styles.row}>
        <MaterialIcons name={category.icon} size={20} color={BrandColors.accent} />
        <Text style={[styles.title, styles.flex]}>{r.title}</Text>
        <Text style={styles.status}>{STATUS_LABEL[r.status]}</Text>
      </View>
      <Text style={styles.muted}>
        {category.label} · {ticketRef(r.id)} · {formatSubmitted(r.createdMs) ?? 'Submitting…'}
      </Text>
      <Text style={styles.muted}>
        {tenantName} · {r.propertyName}
      </Text>
      {r.description ? <Text style={styles.body}>{r.description}</Text> : null}
      <View style={styles.row}>
        {r.status === 'open' ? <AppButton label="Start work" size="sm" variant="secondary" loading={busy} disabled={busy} onPress={() => onSetStatus('in_progress')} style={styles.flex} /> : null}
        {r.status !== 'resolved' ? <AppButton label="Mark resolved" size="sm" loading={busy} disabled={busy} onPress={() => onSetStatus('resolved')} style={styles.flex} /> : null}
        {r.status === 'resolved' ? <AppButton label="Reopen" size="sm" variant="secondary" loading={busy} disabled={busy} onPress={() => onSetStatus('open')} style={styles.flex} /> : null}
      </View>
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/owner/tenants/[tenantId]', params: { tenantId: r.tenantUid, propertyId: r.propertyId } })}>
        <Text style={styles.link}>View tenant</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BrandColors.canvas },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  chipOn: { backgroundColor: BrandColors.accent, borderColor: BrandColors.accent },
  chipText: { fontSize: 13, fontWeight: '700', color: BrandColors.textPrimary },
  chipTextOn: { color: BrandColors.surface },
  content: { padding: 16, paddingBottom: 32, flexGrow: 1 },
  separator: { height: 12 },
  empty: { alignItems: 'center', gap: 8, padding: 32 },
  card: { gap: 8, padding: 16, borderRadius: 16, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  cardOpen: { backgroundColor: '#E3EEEA', borderColor: '#CFE0DA' },
  title: { fontSize: 16, fontWeight: '800', color: BrandColors.textPrimary },
  muted: { fontSize: 13, lineHeight: 19, color: BrandColors.textSecondary },
  body: { fontSize: 14, lineHeight: 21, color: BrandColors.textPrimary },
  status: { fontSize: 13, fontWeight: '700', color: BrandColors.accent },
  link: { fontSize: 14, fontWeight: '700', color: BrandColors.accent },
  error: { marginHorizontal: 16, marginTop: 12, fontSize: 13, color: BrandColors.error },
});
