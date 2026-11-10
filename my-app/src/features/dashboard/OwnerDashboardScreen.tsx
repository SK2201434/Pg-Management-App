import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { OptionSheet } from '@/components/option-sheet';
import { BrandColors } from '@/constants/theme';
import { selectOwner } from '@/features/auth/ownerAuthSelectors';
import { useProfileDisplayName } from '@/features/auth/useUserProfile';
import { CollectedCard, DueSoonCard, NeedsAttention, OutstandingRentCard } from '@/features/dashboard/DashboardCards';
import { CapacityStrip, DashboardHeader, PropertySheet } from '@/features/dashboard/DashboardHeader';
import { greeting } from '@/features/dashboard/dashboardModel';
import { DashboardRemind } from '@/features/dashboard/DashboardRemind';
import { activeIssues, TenantIssuesSwiper } from '@/features/dashboard/TenantIssuesSwiper';
import { useOwnerDashboard } from '@/features/dashboard/useOwnerDashboard';
import { useOwnerPropertyData } from '@/features/dashboard/useOwnerPropertyData';
import { declinedMatches } from '@/features/phoneMatch/phoneMatchModel';
import { usePhoneMatches } from '@/features/phoneMatch/usePhoneMatches';
import { useStayRequests } from '@/features/stayRequests/stayRequestsLive';
import { sortStayRequests } from '@/features/stayRequests/stayRequestsModel';
import { useOwnerTenantRequests } from '@/features/requests/ownerRequestsLive';
import { formatRupees } from '@/features/dashboard/dashboardFormat';
import type { AttentionRow } from '@/features/dashboard/dashboardTypes';
import { ensureRentCharge } from '@/features/rent/rentService';
import { ownerPropertiesQueryKey, useBedOccupancySync } from '@/features/properties/usePropertyQueries';
import { useAppSelector } from '@/store/hooks';

const recordPayment = (propertyId: string, chargeId?: string) =>
  router.push({ pathname: '/owner/properties/[propertyId]/record-payment', params: chargeId ? { propertyId, chargeId } : { propertyId } });

// Owner Home. Every figure comes from the owner's own saved data (properties, beds and the residents
// holding them, tenants, rent charges and payments) through the same queries the other screens use,
// scoped to the selected property or all of them. Not shown because the app has nothing behind them:
// tenant issues, join requests, unverified payments, "Remind All" and reminders, notification history.
export function OwnerDashboardScreen() {
  const owner = useAppSelector(selectOwner);
  // Owners land here first, so properties created earlier are listed for tenants without opening Properties.
  useBedOccupancySync();
  const profileName = useProfileDisplayName();
  const queryClient = useQueryClient();
  const [requestedPropertyId, setRequestedPropertyId] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [choosingTenant, setChoosingTenant] = useState(false);
  const [remindRow, setRemindRow] = useState<AttentionRow | null>(null);
  const [now] = useState(Date.now);

  // Properties first, so a selection that no longer exists falls back to "All Properties".
  const { properties } = useOwnerDashboard(null);
  const propertyList = properties.status === 'ready' ? properties.value : [];
  const selectedPropertyId = propertyList.some((p) => p.id === requestedPropertyId) ? requestedPropertyId : null;

  const data = useOwnerDashboard(selectedPropertyId);
  // Tenants who disowned the phone number the owner entered, for the selected property or all of them.
  const verifyTenants = declinedMatches(usePhoneMatches().matches).filter((m) => selectedPropertyId === null || m.propertyId === selectedPropertyId);
  const selected = propertyList.find((p) => p.id === selectedPropertyId);
  const scopeLabel = propertyList.length === 0 ? null : selected ? selected.name : propertyList.length > 1 ? `All Properties (${propertyList.length})` : propertyList[0].name;
  const monthLabel = new Date(now).toLocaleDateString('en-IN', { month: 'short' });

  // Issues tenants raised, for the selected property or all of them; the bell keeps them live.
  const tenantRequests = useOwnerTenantRequests();
  const issues = activeIssues(tenantRequests.filter((r) => selectedPropertyId === null || r.propertyId === selectedPropertyId));
  const propertyData = useOwnerPropertyData();
  const tenantNames = new Map(propertyData.data.flatMap((p) => (p.tenants ?? []).map((t) => [t.tenantUid, t.name] as const)));

  // Stay requests waiting for the owner's decision, for the selected property or all of them.
  const stay = useStayRequests();
  const pendingStay = sortStayRequests(stay.items).filter((r) => r.status === 'pending' && (selectedPropertyId === null || r.propertyId === selectedPropertyId));

  // Collecting rent: a row that is only scheduled has no charge yet, so one is created first (a payment needs it).
  const [startingKey, setStartingKey] = useState<string | null>(null);
  const startRecord = async (row: AttentionRow) => {
    if (startingKey !== null) return;
    if (row.chargeId !== null) return recordPayment(row.propertyId, row.chargeId);
    setStartingKey(row.key);
    try {
      const chargeId = await ensureRentCharge(row.propertyId, owner?.uid as string, { tenantUid: row.tenantUid, period: row.period, amountInr: row.remainingInr, dueMs: row.dueMs });
      await queryClient.invalidateQueries({ queryKey: ownerPropertiesQueryKey(owner?.uid) });
      recordPayment(row.propertyId, chargeId);
    } catch {
      Alert.alert('Could not start the payment', 'Check your connection and try again.');
    } finally {
      setStartingKey(null);
    }
  };

  // The top button collects from whoever needs attention: the one tenant, or a choice when there are several.
  const attention = data.needsAttention.status === 'ready' ? data.needsAttention.value : [];
  const onRecordPayment = attention.length === 0 ? undefined : () => (attention.length === 1 ? void startRecord(attention[0]) : setChoosingTenant(true));

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => queryClient.invalidateQueries({ queryKey: ['properties'] })} />}>
      <DashboardHeader greeting={greeting(now)} name={profileName ?? owner?.displayName ?? null} scopeLabel={scopeLabel} onOpenSelector={() => setSelecting(true)} />
      <CapacityStrip occupancy={data.occupancy.status === 'ready' ? data.occupancy.value : null} />

      <OutstandingRentCard metric={data.outstandingRent} hasCharges={data.hasCharges} trackingNote={data.trackingNote} onRecordPayment={onRecordPayment} />
      <View style={styles.row}>
        <CollectedCard metric={data.monthlyCollection} monthLabel={monthLabel} style={styles.half} />
        <DueSoonCard metric={data.upcomingRent} style={styles.half} />
      </View>

      <NeedsAttention
        metric={data.needsAttention}
        nowMs={now}
        onRemind={setRemindRow}
        stayRequests={pendingStay}
        onOpenStayRequests={() => router.push('/owner/stay-requests')}
        verifyTenants={verifyTenants}
        onOpenVerify={(m) => router.push({ pathname: '/owner/tenants/[tenantId]', params: { tenantId: m.residentId, propertyId: m.propertyId } })}
        onRecord={(row: AttentionRow) => void startRecord(row)}
        onOpenTenant={(row: AttentionRow) => router.push({ pathname: '/owner/tenants/[tenantId]', params: { tenantId: row.tenantUid, propertyId: row.propertyId } })}
      />

      {issues.length > 0 ? (
        <View style={styles.issues}>
          <View style={styles.issuesHeader}>
            <Text style={styles.issuesTitle}>Tenant Issues</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="View all tenant issues" onPress={() => router.push('/owner/issues')} hitSlop={8}>
              <Text style={styles.issuesCount}>{issues.length} active · View All</Text>
            </Pressable>
          </View>
          <TenantIssuesSwiper items={issues} names={tenantNames} showProperty={selectedPropertyId === null && propertyList.length > 1} />
        </View>
      ) : null}

      <DashboardRemind row={remindRow} data={propertyData.data} nowMs={now} onClose={() => setRemindRow(null)} />
      <PropertySheet visible={selecting} properties={propertyList} selectedId={selectedPropertyId} onSelect={setRequestedPropertyId} onClose={() => setSelecting(false)} />
      <OptionSheet
        visible={choosingTenant}
        title="Collect payment from"
        onClose={() => setChoosingTenant(false)}
        options={attention.map((row) => ({
          label: `${row.name} · ${row.propertyName} · ${formatRupees(row.remainingInr)}`,
          icon: 'person' as const,
          onPress: () => void startRecord(row),
        }))}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BrandColors.canvas },
  content: { padding: 16, paddingBottom: 28, gap: 16 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  issues: { gap: 10 },
  issuesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  issuesTitle: { fontSize: 17, fontWeight: '800', color: BrandColors.textPrimary },
  issuesCount: { fontSize: 13, fontWeight: '700', color: BrandColors.accent },
});
