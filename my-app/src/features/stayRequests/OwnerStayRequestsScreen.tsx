import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Linking, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { useConfirm } from '@/components/confirm-dialog';
import { BrandColors } from '@/constants/theme';
import { formatMoveOutDate, MOVE_OUT_LABEL } from '@/features/moveOut/moveOutModel';
import type { OwnerMoveOutRequest } from '@/features/moveOut/moveOutService';
import { useDecideMoveOut, useOwnerMoveOutRequests } from '@/features/moveOut/useMoveOut';
import { telUrl } from '@/features/tenantHome/stayModel';
import { declinedMatches, placementOf, type PhoneMatch } from '@/features/phoneMatch/phoneMatchModel';
import { usePhoneMatchActions, usePhoneMatches } from '@/features/phoneMatch/usePhoneMatches';
import { decideStayRequest, useStayRequests } from '@/features/stayRequests/stayRequestsLive';
import { pendingCount, sortStayRequests, STATUS_TEXT, type OwnerStayRequest } from '@/features/stayRequests/stayRequestsModel';

// Tenants' requests to stay, for the owner. They update live. Approving assigns a bed (Add Tenant,
// prefilled) and adds the tenant to the property in one save; declining only records the decision.
export function OwnerStayRequestsScreen() {
  const live = useStayRequests();
  const { confirm, dialog } = useConfirm();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const moveOuts = useOwnerMoveOutRequests();
  const allMatches = usePhoneMatches().matches;
  const phoneMatches = allMatches.filter((m) => !m.declined);
  const verifyMatches = declinedMatches(allMatches);
  const matchActions = usePhoneMatchActions();
  const [matchBusy, setMatchBusy] = useState<string | null>(null);
  const decideMoveOut = useDecideMoveOut();
  const moveOutItems = [...(moveOuts.data ?? [])].sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending') || (b.updatedMs ?? Number.MAX_SAFE_INTEGER) - (a.updatedMs ?? Number.MAX_SAFE_INTEGER));
  const items = sortStayRequests(live.items);
  const pending = pendingCount(items);

  // Approving means giving the tenant a bed: it opens Add Tenant with the tenant prefilled, and saving
  // there approves the request and adds them to the property. Declining only records the decision.
  const approve = (r: OwnerStayRequest) =>
    router.push({
      pathname: '/owner/add-tenant',
      params: { propertyId: r.propertyId, requestTenantUid: r.tenantUid, requestTenantName: r.tenantName, requestPhone: r.tenantPhone ?? '', requestGender: r.tenantGender ?? '', requestEmail: r.tenantEmail ?? '' },
    });

  const decideMove = async (r: OwnerMoveOutRequest, status: 'approved' | 'rejected') => {
    if (status === 'rejected') {
      const ok = await confirm({ title: 'Decline this move-out?', message: `${r.tenantName} will be told you declined.`, confirmLabel: 'Decline', destructive: true });
      if (!ok) return;
    }
    setError(null);
    decideMoveOut.mutate(
      { request: r, status },
      { onError: () => setError('Could not save your decision. Check your connection and try again.') },
    );
  };

  const linkMatch = async (m: PhoneMatch) => {
    const ok = await confirm({
      title: 'Link this account?',
      message: `${m.tenantName} will be linked to ${m.residentName}${placementOf(m) ? ` (${placementOf(m)})` : ''} and will see their stay details in the app. Only do this if it is the same person.`,
      confirmLabel: 'Link account',
    });
    if (!ok) return;
    setMatchBusy(m.id);
    setError(null);
    matchActions.link.mutate(m, {
      onError: () => setError('Could not link the account. Check your connection and try again.'),
      onSettled: () => setMatchBusy(null),
    });
  };

  const dismissMatch = (m: PhoneMatch) => {
    setMatchBusy(m.id);
    setError(null);
    matchActions.dismiss.mutate(m, {
      onError: () => setError('Could not save your choice. Check your connection and try again.'),
      onSettled: () => setMatchBusy(null),
    });
  };

  const decline = async (r: OwnerStayRequest) => {
    const ok = await confirm({ title: 'Decline this request?', message: `${r.tenantName} will be told you declined.`, confirmLabel: 'Decline', destructive: true });
    if (!ok) return;
    const key = `${r.propertyId}_${r.tenantUid}`;
    setBusyKey(key);
    setError(null);
    try {
      await decideStayRequest(r.propertyId, r.tenantUid, 'rejected');
    } catch {
      setError('Could not save your decision. Check your connection and try again.');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Stay requests', headerTitle: pending > 0 ? `${pending} waiting` : '' }} />
      {!live.ready ? (
        <View style={styles.center}>
          <ActivityIndicator color={BrandColors.accent} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(r) => `${r.propertyId}_${r.tenantUid}`}
          contentContainerStyle={styles.content}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListHeaderComponent={
            <View>
              {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
              {verifyMatches.length > 0 ? (
                <View style={styles.moveOuts}>
                  <Text style={styles.sectionLabel}>Verify your tenants’ details</Text>
                  {verifyMatches.map((m) => (
                    <VerifyTenantCard key={m.id} match={m} />
                  ))}
                </View>
              ) : null}
              {phoneMatches.length > 0 ? (
                <View style={styles.moveOuts}>
                  <Text style={styles.sectionLabel}>Confirm your tenants</Text>
                  {phoneMatches.map((m) => (
                    <PhoneMatchCard key={m.id} match={m} busy={matchBusy === m.id} onLink={() => void linkMatch(m)} onDismiss={() => dismissMatch(m)} />
                  ))}
                  {items.length > 0 && moveOutItems.length === 0 ? <Text style={styles.sectionLabel}>Stay requests</Text> : null}
                </View>
              ) : null}
              {moveOutItems.length > 0 ? (
                <View style={styles.moveOuts}>
                  <Text style={styles.sectionLabel}>Move-out requests</Text>
                  {moveOutItems.map((r) => (
                    <MoveOutCard key={`${r.propertyId}_${r.tenantUid}`} request={r} busy={decideMoveOut.isPending} onApprove={() => void decideMove(r, 'approved')} onDecline={() => void decideMove(r, 'rejected')} />
                  ))}
                  {items.length > 0 ? <Text style={styles.sectionLabel}>Stay requests</Text> : null}
                </View>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <MaterialIcons name="how-to-reg" size={32} color={BrandColors.textSecondary} />
              <Text style={styles.title}>{live.failed ? 'Couldn’t load requests' : 'No stay requests yet'}</Text>
              <Text style={styles.muted}>{live.failed ? 'Check your connection and try again later.' : 'When a tenant asks to stay at one of your properties, it appears here at once.'}</Text>
            </View>
          }
          renderItem={({ item }) => <RequestCard request={item} busy={busyKey === `${item.propertyId}_${item.tenantUid}`} onApprove={() => approve(item)} onDecline={() => void decline(item)} />}
        />
      )}
      {dialog}
    </View>
  );
}

// The tenant said the phone number the owner entered is not theirs. It stays until the owner corrects the details
// (the number moves, so this match goes away) or unassigns the bed.
function VerifyTenantCard({ match: m }: { match: PhoneMatch }) {
  return (
    <View style={[styles.card, styles.cardAlert]}>
      <Text style={styles.title} numberOfLines={1}>{m.residentName}</Text>
      <Text style={styles.body}>
        {m.tenantName} says the phone number you entered for {m.residentName}
        {placementOf(m) ? ` (${placementOf(m)})` : ''} at {m.propertyName} is not theirs. Please verify the details: correct the number, or unassign the bed.
      </Text>
      <AppButton label="Open tenant" size="sm" onPress={() => router.push({ pathname: '/owner/tenants/[tenantId]', params: { tenantId: m.residentId, propertyId: m.propertyId } })} />
    </View>
  );
}

function PhoneMatchCard({ match: m, busy, onLink, onDismiss }: { match: PhoneMatch; busy: boolean; onLink: () => void; onDismiss: () => void }) {
  const call = telUrl(m.phone);
  return (
    <View style={[styles.card, styles.cardPending]}>
      <Text style={styles.title} numberOfLines={1}>{m.tenantName}</Text>
      <Text style={styles.body}>
        created a HOSTELL account with the phone number of your tenant {m.residentName}
        {placementOf(m) ? ` (${placementOf(m)})` : ''} at {m.propertyName}. Please confirm their details.
      </Text>
      <View style={styles.row}>
        <Text style={[styles.muted, styles.flex]}>{m.phone}</Text>
        {call ? <AppButton label="Call" icon="call" size="sm" variant="secondary" onPress={() => Linking.openURL(call).catch(() => {})} /> : null}
      </View>
      <Text style={styles.muted}>Phone numbers are not verified, so check that it is the same person before linking.</Text>
      <View style={styles.row}>
        <AppButton label="Not them" variant="secondary" size="sm" disabled={busy} onPress={onDismiss} style={styles.flex} />
        <AppButton label="Link account" size="sm" loading={busy} onPress={onLink} style={styles.flex} />
      </View>
    </View>
  );
}

function MoveOutCard({ request: r, busy, onApprove, onDecline }: { request: OwnerMoveOutRequest; busy: boolean; onApprove: () => void; onDecline: () => void }) {
  return (
    <View style={[styles.card, r.status === 'pending' && styles.cardPending]}>
      <Text style={styles.title} numberOfLines={1}>{r.tenantName}</Text>
      <Text style={styles.muted}>{r.propertyName}</Text>
      <Text style={styles.body}>
        {r.kind === 'instant' ? 'Wants to move out now' : `Wants to move out after ${r.months} ${r.months === 1 ? 'month' : 'months'}`} · {formatMoveOutDate(r.moveOutMs)}
      </Text>
      {r.status === 'pending' ? (
        <View style={styles.row}>
          <AppButton label="Decline" variant="secondary" size="sm" disabled={busy} onPress={onDecline} style={styles.flex} />
          <AppButton label="Approve" size="sm" loading={busy} onPress={onApprove} style={styles.flex} />
        </View>
      ) : (
        <Text style={styles.status}>{MOVE_OUT_LABEL[r.status]}</Text>
      )}
    </View>
  );
}

function RequestCard({ request: r, busy, onApprove, onDecline }: { request: OwnerStayRequest; busy: boolean; onApprove: () => void; onDecline: () => void }) {
  const call = telUrl(r.tenantPhone);
  const when = (r.updatedMs ?? r.createdMs) === null ? 'Just now' : new Date((r.updatedMs ?? r.createdMs) as number).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <View style={[styles.card, r.status === 'pending' && styles.cardPending]}>
      <View style={styles.row}>
        <Text style={[styles.title, styles.flex]} numberOfLines={1}>{r.tenantName}</Text>
        <Text style={styles.muted}>{when}</Text>
      </View>
      <Text style={styles.muted}>For {r.propertyName}</Text>
      {r.message ? <Text style={styles.body}>{r.message}</Text> : null}
      {r.tenantPhone ? (
        <View style={styles.row}>
          <Text style={[styles.muted, styles.flex]}>{r.tenantPhone}</Text>
          {call ? <AppButton label="Call" icon="call" size="sm" variant="secondary" onPress={() => Linking.openURL(call).catch(() => {})} /> : null}
        </View>
      ) : null}
      {r.status === 'pending' ? (
        <View style={styles.row}>
          <AppButton label="Decline" variant="secondary" size="sm" disabled={busy} loading={busy} onPress={onDecline} style={styles.flex} />
          <AppButton label="Approve & assign bed" size="sm" disabled={busy} onPress={onApprove} style={styles.flex} />
        </View>
      ) : (
        <Text style={styles.status}>{STATUS_TEXT[r.status]}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BrandColors.canvas },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 },
  content: { padding: 16, paddingBottom: 32, flexGrow: 1 },
  separator: { height: 12 },
  card: { gap: 8, padding: 16, borderRadius: 16, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  cardPending: { backgroundColor: '#E3EEEA', borderColor: '#CFE0DA' },
  cardAlert: { backgroundColor: BrandColors.errorTint, borderColor: BrandColors.error },
  title: { fontSize: 16, fontWeight: '800', color: BrandColors.textPrimary },
  muted: { fontSize: 13, lineHeight: 19, textAlign: 'left', color: BrandColors.textSecondary },
  body: { fontSize: 14, lineHeight: 21, color: BrandColors.textPrimary },
  status: { fontSize: 13, fontWeight: '700', color: BrandColors.accent },
  moveOuts: { gap: 12, marginBottom: 12 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: BrandColors.textSecondary },
  error: { marginBottom: 12, fontSize: 13, color: BrandColors.error },
});
