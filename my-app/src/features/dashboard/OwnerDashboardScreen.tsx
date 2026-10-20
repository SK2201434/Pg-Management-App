import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { OptionSheet } from '@/components/option-sheet';
import { BrandColors } from '@/constants/theme';
import { selectOwner } from '@/features/auth/ownerAuthSelectors';
import { useProfileDisplayName } from '@/features/auth/useUserProfile';
import { CollectedCard, DueSoonCard, NeedsAttention, OutstandingRentCard } from '@/features/dashboard/DashboardCards';
import { CapacityStrip, DashboardHeader, PropertySheet } from '@/features/dashboard/DashboardHeader';
import { greeting } from '@/features/dashboard/dashboardModel';
import { useOwnerDashboard } from '@/features/dashboard/useOwnerDashboard';
import { formatRupees } from '@/features/dashboard/dashboardFormat';
import type { AttentionRow } from '@/features/dashboard/dashboardTypes';
import { useAppSelector } from '@/store/hooks';

const recordPayment = (propertyId: string, chargeId?: string) =>
  router.push({ pathname: '/owner/properties/[propertyId]/record-payment', params: chargeId ? { propertyId, chargeId } : { propertyId } });

// Owner Home. Every figure comes from the owner's own saved data (properties, beds and the residents
// holding them, tenants, rent charges and payments) through the same queries the other screens use,
// scoped to the selected property or all of them. Not shown because the app has nothing behind them:
// tenant issues, join requests, unverified payments, "Remind All" and reminders, notification history.
export function OwnerDashboardScreen() {
  const owner = useAppSelector(selectOwner);
  const profileName = useProfileDisplayName();
  const queryClient = useQueryClient();
  const [requestedPropertyId, setRequestedPropertyId] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [choosingProperty, setChoosingProperty] = useState(false);
  const [now] = useState(Date.now);

  // Properties first, so a selection that no longer exists falls back to "All Properties".
  const { properties } = useOwnerDashboard(null);
  const propertyList = properties.status === 'ready' ? properties.value : [];
  const selectedPropertyId = propertyList.some((p) => p.id === requestedPropertyId) ? requestedPropertyId : null;

  const data = useOwnerDashboard(selectedPropertyId);
  const selected = propertyList.find((p) => p.id === selectedPropertyId);
  const scopeLabel = propertyList.length === 0 ? null : selected ? selected.name : propertyList.length > 1 ? `All Properties (${propertyList.length})` : propertyList[0].name;
  const monthLabel = new Date(now).toLocaleDateString('en-IN', { month: 'short' });

  const owing = data.owing;
  const onRecordPayment =
    owing.length === 0
      ? undefined
      : () => (owing.length === 1 ? recordPayment(owing[0].propertyId) : setChoosingProperty(true));

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => queryClient.invalidateQueries({ queryKey: ['properties'] })} />}>
      <DashboardHeader greeting={greeting(now)} name={profileName ?? owner?.displayName ?? null} scopeLabel={scopeLabel} onOpenSelector={() => setSelecting(true)} />
      <CapacityStrip occupancy={data.occupancy.status === 'ready' ? data.occupancy.value : null} />

      <OutstandingRentCard metric={data.outstandingRent} hasCharges={data.hasCharges} onRecordPayment={onRecordPayment} />
      <View style={styles.row}>
        <CollectedCard metric={data.monthlyCollection} monthLabel={monthLabel} style={styles.half} />
        <DueSoonCard metric={data.upcomingRent} style={styles.half} />
      </View>

      <NeedsAttention
        metric={data.needsAttention}
        onRecord={(row: AttentionRow) => recordPayment(row.propertyId, row.chargeId)}
        onOpenTenant={(row: AttentionRow) => router.push({ pathname: '/owner/tenants/[tenantId]', params: { tenantId: row.tenantUid, propertyId: row.propertyId } })}
      />

      <PropertySheet visible={selecting} properties={propertyList} selectedId={selectedPropertyId} onSelect={setRequestedPropertyId} onClose={() => setSelecting(false)} />
      <OptionSheet
        visible={choosingProperty}
        title="Record payment for which property?"
        onClose={() => setChoosingProperty(false)}
        options={owing.map((o) => ({ label: `${o.propertyName} · ${formatRupees(o.amountInr)} due`, icon: 'apartment' as const, onPress: () => recordPayment(o.propertyId) }))}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BrandColors.canvas },
  content: { padding: 16, paddingBottom: 28, gap: 16 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
});
