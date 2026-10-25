import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { BrandColors } from '@/constants/theme';
import { useMyStayRequestViews } from '@/features/discovery/useMyStayRequestViews';
import { useRefetchOnFocus } from '@/features/tenantHome/useRefetchOnFocus';
import { StayRequestCard, StayRequestsSection } from '@/features/requests/StayRequestsSection';
import { NewRequestSheet } from '@/features/requests/NewRequestSheet';
import {
  STATUS_FILTERS,
  STATUS_LABEL,
  categoryOf,
  countRequests,
  combineRequests,
  filterRequests,
  formatSubmitted,
  ticketRef,
  type RequestStatus,
  type StatusFilter,
  type TenantRequest,
} from '@/features/requests/requestsModel';
import { useCreateRequest, useTenantRequests } from '@/features/requests/useTenantRequests';
import { canRaiseRequest } from '@/features/tenantHome/tenantHomeModel';
import { useTenantStay } from '@/features/tenantHome/useTenantStay';

const STATUS_STYLE: Record<RequestStatus, { fg: string; bg: string }> = {
  open: { fg: '#9E7231', bg: '#FDF7EB' },
  in_progress: { fg: BrandColors.accent, bg: '#E8F0EE' },
  resolved: { fg: '#38775B', bg: '#EDF6F1' },
};

// The one Requests screen: the Requests tab and Home's "View All" both land here. The tenant's
// property comes from their own active membership, and the rules re-check it on every write.
export function TenantRequestsScreen() {
  const stay = useTenantStay();
  const [now] = useState(Date.now);
  const active = canRaiseRequest(stay.data, now) ? stay.data : undefined;
  const requests = useTenantRequests(stay.data);
  const stayRequests = useMyStayRequestViews();
  useRefetchOnFocus(stay.refetch);
  const create = useCreateRequest(active);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (stay.isPending) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={BrandColors.accent} />
      </View>
    );
  }
  if (stay.isError || !stay.data) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.cardTitle}>Could not load your stay</Text>
        <Text style={styles.muted}>Check your connection and try again.</Text>
        <Pressable accessibilityRole="button" onPress={() => stay.refetch()}>
          <Text style={styles.link}>Retry</Text>
        </Pressable>
      </View>
    );
  }
  if (stay.data.state !== 'active') {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <StayRequestsSection items={stayRequests.items} />
        <View style={styles.empty}>
          <MaterialIcons name="home-work" size={32} color={BrandColors.textSecondary} />
          <Text style={styles.cardTitle}>No active stay</Text>
          <Text style={styles.mutedCenter}>Maintenance requests need an active stay. Once you have joined a property, you can raise them here.</Text>
        </View>
      </ScrollView>
    );
  }

  const all = requests.data ?? [];
  // Stay requests have no ticket status, so they show under All only; everything is newest first.
  const combined = combineRequests(filter === 'all' ? stayRequests.items : [], filterRequests(all, filter));
  const submitError = create.isError
    ? (create.error as { code?: string }).code === 'permission-denied'
      ? 'You can’t submit requests for this property right now.'
      : 'Could not submit your request. Check your connection and try again.'
    : null;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={requests.isRefetching}
            onRefresh={() => {
              stay.refetch();
              requests.refetch();
            }}
            tintColor={BrandColors.accent}
            colors={[BrandColors.accent]}
          />
        }>
        <View style={styles.card}>
          <View style={[styles.row, styles.spread]}>
            <View style={styles.flex}>
              <Text numberOfLines={1} style={styles.cardTitle}>{stay.data.propertyName}</Text>
              {stay.data.location ? <Text numberOfLines={1} style={styles.muted}>{stay.data.location}</Text> : null}
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{active ? 'Active stay' : 'Stay ended'}</Text>
            </View>
          </View>
          <View style={[styles.row, styles.spread]}>
            <View style={styles.flex}>
              <Text style={styles.heading}>Maintenance</Text>
              <Text style={styles.muted}>Track service tickets for your stay</Text>
            </View>
            <AppButton
              label="New Request"
              icon="add"
              size="sm"
              disabled={!active}
              onPress={() => {
                create.reset();
                setOpen(true);
              }}
            />
          </View>
          {!active ? <Text style={styles.muted}>Your stay has ended, so new requests can’t be raised.</Text> : null}
        </View>

        {notice ? (
          <View style={styles.notice} accessibilityRole="alert">
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ) : null}

        <View style={styles.metrics}>
          <Metric label="Open" value={requests.data ? countRequests(all, 'open') : null} unit="ticket" color={STATUS_STYLE.open.fg} />
          <Metric label="Progress" value={requests.data ? countRequests(all, 'in_progress') : null} unit="active" color={STATUS_STYLE.in_progress.fg} />
          <Metric label="Resolved" value={requests.data ? countRequests(all, 'resolved') : null} unit="closed" color={STATUS_STYLE.resolved.fg} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
          {STATUS_FILTERS.map((f) => {
            const selected = f.key === filter;
            return (
              <Pressable
                key={f.key}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setFilter(f.key)}
                style={[styles.pill, selected && styles.pillOn]}>
                <Text style={[styles.pillText, selected && styles.pillTextOn]}>
                  {f.label}
                  {requests.data ? ` (${countRequests(all, f.key)})` : ''}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {combined.map((c) => (c.kind === 'stay' ? <StayRequestCard key={c.key} request={c.request} /> : <RequestCard key={c.key} request={c.request} />))}

        {requests.isPending ? (
          <View style={styles.center}>
            <ActivityIndicator color={BrandColors.accent} />
          </View>
        ) : requests.isError ? (
          <View style={styles.empty}>
            <Text style={styles.cardTitle}>Could not load your requests</Text>
            <Text style={styles.mutedCenter}>Check your connection and try again.</Text>
            <Pressable accessibilityRole="button" onPress={() => requests.refetch()}>
              <Text style={styles.link}>Retry</Text>
            </Pressable>
          </View>
        ) : combined.length > 0 ? null : all.length === 0 && stayRequests.items.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons name="task-alt" size={28} color={BrandColors.accent} />
            <Text style={styles.cardTitle}>No requests yet</Text>
            <Text style={styles.mutedCenter}>Tickets you raise for your stay will appear here.</Text>
          </View>
        ) : (

          <View style={styles.empty}>
            <MaterialIcons name="task-alt" size={28} color={BrandColors.accent} />
            <Text style={styles.cardTitle}>No requests found</Text>
            <Text style={styles.mutedCenter}>No requests match this filter.</Text>
            <Pressable accessibilityRole="button" onPress={() => setFilter('all')}>
              <Text style={styles.link}>Show All Requests</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {open && active ? (
        <NewRequestSheet
          propertyName={active.propertyName}
          busy={create.isPending}
          submitError={submitError}
          onSubmit={(input) =>
            create.mutate(input, {
              onSuccess: () => {
                setOpen(false);
                setFilter('all');
                setNotice('Request submitted.');
              },
            })
          }
          onClose={() => setOpen(false)}
        />
      ) : null}
    </View>
  );
}

function Metric({ label, value, unit, color }: { label: string; value: number | null; unit: string; color: string }) {
  return (
    <View style={styles.metric}>
      <View style={[styles.row, styles.spread]}>
        <Text style={styles.metricLabel}>{label}</Text>
        <View style={[styles.dot, { backgroundColor: color }]} />
      </View>
      <Text style={styles.metricValue}>
        {value ?? '–'} <Text style={styles.metricUnit}>{unit}</Text>
      </Text>
    </View>
  );
}

function RequestCard({ request }: { request: TenantRequest }) {
  const category = categoryOf(request.category);
  const tone = STATUS_STYLE[request.status];
  const submitted = formatSubmitted(request.createdMs);
  return (
    <View style={styles.card}>
      <View style={[styles.row, styles.spread]}>
        <View style={[styles.row, styles.flex]}>
          <View style={[styles.iconBox, { backgroundColor: tone.bg }]}>
            <MaterialIcons name={category.icon} size={20} color={tone.fg} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.metricLabel}>{category.label} · {ticketRef(request.id)}</Text>
            <Text numberOfLines={1} style={styles.cardTitle}>{request.title}</Text>
          </View>
        </View>
        <View style={[styles.badge, { backgroundColor: tone.bg }]}>
          <Text style={[styles.badgeText, { color: tone.fg }]}>{STATUS_LABEL[request.status]}</Text>
        </View>
      </View>
      {request.description ? <Text numberOfLines={2} style={styles.muted}>{request.description}</Text> : null}
      <Text style={styles.muted}>{submitted ?? 'Submitting…'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BrandColors.canvas },
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  spread: { justifyContent: 'space-between' },
  card: { gap: 10, padding: 16, borderRadius: 16, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  cardTitle: { fontSize: 15, fontWeight: '800', color: BrandColors.textPrimary },
  heading: { fontSize: 20, fontWeight: '800', color: BrandColors.textPrimary },
  muted: { fontSize: 13, lineHeight: 19, color: BrandColors.textSecondary },
  mutedCenter: { fontSize: 13, lineHeight: 19, textAlign: 'center', color: BrandColors.textSecondary },
  link: { fontSize: 14, fontWeight: '700', color: BrandColors.accent },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#E8F0EE' },
  badgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, color: BrandColors.accent },
  notice: { padding: 12, borderRadius: 12, backgroundColor: '#E8F0EE' },
  noticeText: { fontSize: 13, fontWeight: '600', color: BrandColors.textPrimary },
  metrics: { flexDirection: 'row', gap: 8 },
  metric: { flex: 1, gap: 6, padding: 12, borderRadius: 14, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  metricLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: BrandColors.textSecondary },
  metricValue: { fontSize: 22, fontWeight: '800', color: BrandColors.textPrimary },
  metricUnit: { fontSize: 11, fontWeight: '600', color: BrandColors.textSecondary },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pills: { gap: 8, paddingVertical: 2 },
  pill: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  pillOn: { backgroundColor: '#6D9990', borderColor: '#6D9990' },
  pillText: { fontSize: 13, fontWeight: '600', color: BrandColors.textSecondary },
  pillTextOn: { color: '#FFFFFF' },
  empty: { alignItems: 'center', gap: 6, padding: 28, borderRadius: 16, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
