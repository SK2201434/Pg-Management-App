import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/app-button';
import { AppScrollView } from '@/components/app-scroll-view';
import { OptionSheet } from '@/components/option-sheet';
import { BrandColors } from '@/constants/theme';
import { TopBarIconButton } from '@/features/navigation/AppTopBar';
import { parsePropertyId } from '@/features/properties/propertyDetailsModel';
import { StateCard } from '@/features/properties/PropertyDetailsScreen';
import { getPropertyErrorMessage } from '@/features/properties/propertyService';
import { sharingLabel } from '@/features/properties/propertySetup';
import type { PropertyDetail } from '@/features/properties/propertyTypes';
import { initials } from '@/features/properties/tenantsModel';
import { usePropertyRooms, usePropertyTenants } from '@/features/properties/usePropertyQueries';
import { PropertyGate } from '@/features/rent/PropertyGate';
import { buildLedger, formatDate, formatInr, formatPeriod, PAYMENT_METHODS } from '@/features/rent/rentModel';
import { StatusBadge } from '@/features/rent/rentUi';
import { usePayments, useRentCharges } from '@/features/rent/useRentQueries';
import { ChangeStaySheet } from '@/features/stayChange/ChangeStaySheet';
import { canChangeStay, freeBedChoices } from '@/features/stayChange/stayChangeModel';
import { useStayChange, useStayChangeActions } from '@/features/stayChange/useStayChange';
import { RemindDialog } from '@/features/rent/RemindDialog';
import { buildRentReminder, nextReminderOpensMs, withMessage } from '@/features/rent/reminderModel';
import { AlreadyRemindedError } from '@/features/rent/reminderService';
import { useSendRentReminder } from '@/features/rent/useRentReminders';
import { latestRow, mailUrl, pickPayableCharge, telUrl, totalOutstanding, whatsAppUrl } from '@/features/tenants/tenantDetailsModel';
import { EditTenantSheet } from '@/features/tenants/EditTenantSheet';
import { useRemoveResident, useResidentDetail, useUpdateResident } from '@/features/tenants/useAddResident';
import { ResidentHasRentRecordsError } from '@/features/tenants/residentService';
import { useConfirm } from '@/components/confirm-dialog';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

const goToTenants = () => router.replace('/owner/tenants');

// Tenant Details. Route `/owner/tenants/[tenantId]?propertyId=`: a tenant lives under a property, so
// both ids are required and the property is verified as the signed-in owner's before anything is
// shown. Data: the tenant (joined or added), the stay on an added tenant's own record, and the rent
// charges and payments of this property filtered to this tenant. Not available, so not shown: reminders,
// editing, changing bed, KYC documents.
export function TenantDetailsScreen() {
  const params = useLocalSearchParams<{ tenantId?: string | string[]; propertyId?: string | string[] }>();
  const propertyId = parsePropertyId(params.propertyId);
  const tenantId = parsePropertyId(params.tenantId);
  return (
    <PropertyGate propertyId={tenantId === null ? null : propertyId} title="Tenant Details">
      {(property) => <Content key={`${property.id}/${tenantId}`} property={property} tenantId={tenantId as string} />}
    </PropertyGate>
  );
}

function Content({ property, tenantId }: { property: PropertyDetail; tenantId: string }) {
  const insets = useSafeAreaInsets();
  const tenants = usePropertyTenants(property.id);
  const rooms = usePropertyRooms(property.id);
  const charges = useRentCharges(property.id);
  const payments = usePayments(property.id);
  const [now] = useState(Date.now);
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [remindOpen, setRemindOpen] = useState(false);
  const sendReminder = useSendRentReminder(property.id);

  const tenant = tenants.data?.find((t) => t.tenantUid === tenantId) ?? null;
  const resident = useResidentDetail(property.id, tenantId, tenant?.source === 'added');
  const update = useUpdateResident(property.id, tenantId, resident.data?.bedId ?? null);
  const remove = useRemoveResident(property.id, tenantId);
  const { confirm, dialog } = useConfirm();
  // Changing the room or bed is a proposal the tenant must accept (they need an app account to answer).
  const [stayOpen, setStayOpen] = useState(false);
  const stayChange = useStayChange(property.id, tenant?.accountUid);
  const stayActions = useStayChangeActions(property.id, tenant?.accountUid);

  const ledger = useMemo(() => {
    if (!charges.data || !payments.data || !tenant) return null;
    return buildLedger(charges.data, payments.data, new Map([[tenant.tenantUid, tenant.name]]), now).filter((r) => r.charge.tenantUid === tenant.tenantUid);
  }, [charges.data, payments.data, tenant, now]);
  const myPayments = useMemo(
    () => (payments.data ?? []).filter((p) => p.tenantUid === tenantId).sort((a, b) => b.paidMs - a.paidMs),
    [payments.data, tenantId],
  );

  const header = (
    <Stack.Screen
      options={{
        title: 'Tenant Details',
        headerTitle: property.name,
        headerRight: () => <TopBarIconButton icon="more-vert" label="Tenant actions" onPress={() => setMenu(true)} />,
      }}
    />
  );
  const refresh = () => {
    tenants.refetch();
    rooms.refetch();
    charges.refetch();
    payments.refetch();
    resident.refetch();
  };

  if (tenants.isPending) {
    return (
      <View style={[styles.screen, styles.center]}>
        {header}
        <ActivityIndicator color={BrandColors.accent} />
        <Text style={styles.muted}>Loading tenant…</Text>
      </View>
    );
  }
  if (tenants.isError) {
    return (
      <AppScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {header}
        <StateCard icon="error-outline" title="Couldn’t load the tenant" message={getPropertyErrorMessage(tenants.error)} actionLabel="Retry" onAction={() => tenants.refetch()} />
      </AppScrollView>
    );
  }
  if (!tenant) {
    return (
      <AppScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {header}
        <StateCard icon="search-off" title="Tenant not found" message="This tenant is not part of this property." actionLabel="Back to tenants" onAction={goToTenants} />
      </AppScrollView>
    );
  }

  const detail = resident.data ?? null;
  const added = tenant.source === 'added';
  const room = detail?.roomId ? rooms.data?.find((r) => r.id === detail.roomId) ?? null : null;
  const active = tenant.status === 'active';
  const hasStay = added && tenant.roomNumber !== null;
  const phone = detail?.phone ?? null;
  const payable = ledger ? pickPayableCharge(ledger) : null;
  const rentReady = ledger !== null;
  // A tenant with an app account (added from a stay request) has a verified profile the owner cannot edit.
  const canEdit = added && !tenant?.accountUid && detail !== null && detail.bedId !== null && detail.phone !== null;
  const outstanding = ledger && ledger.length > 0 ? totalOutstanding(ledger) : null;
  const latest = ledger ? latestRow(ledger) : null;

  // The rent reminder: the month and the amount still payable, in a polite message.
  // The bed's rent is due on the move-in day each month, and reminding opens a week before.
  const schedule = active && detail?.moveInMs != null && detail.rentInr !== null ? { moveInMs: detail.moveInMs, rentInr: detail.rentInr } : null;
  const reminder = ledger && tenant ? buildRentReminder({ tenantName: tenant.name, propertyName: property.name, rows: ledger, nowMs: now, schedule }) : null;
  const opensMs = ledger ? nextReminderOpensMs({ rows: ledger, schedule, nowMs: now }) : null;
  const remindError = sendReminder.isError
    ? sendReminder.error instanceof AlreadyRemindedError
      ? 'You already sent this tenant a reminder for this month today.'
      : 'Could not send the reminder. Check your connection and try again.'
    : null;
  const notify = () => {
    if (!reminder || !tenant?.accountUid) return;
    sendReminder.mutate(
      { tenantUid: tenant.accountUid, reminder },
      {
        onSuccess: () => {
          setRemindOpen(false);
          setBanner(`Reminder sent to ${tenant.name}.`);
        },
      },
    );
  };

  const canChange = canChangeStay(tenant) && detail !== null && detail.bedId !== null;
  const stayError = stayActions.propose.isError
    ? 'Could not send the proposal. That bed may have just been taken; pick another and try again.'
    : stayActions.apply.isError
      ? 'Could not apply the change. The bed may have been taken, or the tenant has not accepted yet.'
      : stayActions.cancel.isError
        ? 'Could not cancel the proposal. Try again.'
        : null;
  const resetStayErrors = () => {
    stayActions.propose.reset();
    stayActions.cancel.reset();
    stayActions.apply.reset();
  };

  const open = async (url: string | null) => {
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {
      // No app can open the link on this device.
    }
  };
  const openLedger = () => router.push({ pathname: '/owner/properties/[propertyId]/rent-ledger', params: { propertyId: property.id } });
  const recordPayment = () =>
    payable &&
    router.push({ pathname: '/owner/properties/[propertyId]/record-payment', params: { propertyId: property.id, chargeId: payable.charge.id } });

  return (
    <View style={styles.screen}>
      {header}
      <ChangeStaySheet
        visible={stayOpen}
        tenantName={tenant.name}
        current={{ roomNumber: tenant.roomNumber ?? '', bedLabel: tenant.bedLabel }}
        choices={freeBedChoices(rooms.data ?? [], detail?.bedId ?? null)}
        existing={stayChange.data ?? null}
        busy={stayActions.propose.isPending || stayActions.cancel.isPending || stayActions.apply.isPending}
        error={stayError}
        onPropose={(target) =>
          stayActions.propose.mutate(
            { residentId: tenant.tenantUid, from: { roomNumber: tenant.roomNumber ?? '', bedLabel: tenant.bedLabel }, target },
            { onSuccess: () => setBanner(`Sent to ${tenant.name}. Their room changes only after they accept.`) },
          )
        }
        onCancel={() => stayActions.cancel.mutate(undefined)}
        onApply={() => stayChange.data && stayActions.apply.mutate(stayChange.data, { onSuccess: () => { setStayOpen(false); setBanner(`${tenant.name} has been moved to the new room and bed.`); } })}
        onClose={() => setStayOpen(false)}
      />
      <RemindDialog
        visible={remindOpen}
        tenantName={tenant.name}
        reminder={reminder}
        canNotify={!!tenant.accountUid}
        busy={sendReminder.isPending}
        error={remindError}
        callUrl={telUrl(phone)}
        whatsAppUrl={reminder && whatsAppUrl(phone) ? withMessage(whatsAppUrl(phone) as string, reminder.message) : whatsAppUrl(phone)}
        onNotify={notify}
        onOpen={(url) => {
          setRemindOpen(false);
          void open(url);
        }}
        onClose={() => setRemindOpen(false)}
      />
      <AppScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={tenants.isRefetching && !tenants.isPending} onRefresh={refresh} />}>
        {banner ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Dismiss message" onPress={() => setBanner(null)} style={styles.banner}>
            <MaterialIcons name="check-circle" size={18} color={BrandColors.accent} />
            <Text style={styles.bannerText}>{banner}</Text>
          </Pressable>
        ) : null}
        <View style={styles.card}>
          <View style={styles.profile}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(tenant.name)}</Text>
            </View>
            <View style={styles.flex}>
              <View style={styles.spread}>
                <Text numberOfLines={1} style={[styles.name, styles.flex]}>
                  {tenant.name}
                </Text>
                <View style={[styles.badge, active ? styles.badgeOn : styles.badgeOff]}>
                  <Text style={[styles.badgeText, active && { color: BrandColors.accent }]}>{active ? 'Active' : 'Inactive'}</Text>
                </View>
              </View>
              <Text style={styles.small}>
                {[
                  tenant.joinedAtMs !== null ? `${added ? 'Moved in' : 'Joined'} ${formatDate(tenant.joinedAtMs)}` : null,
                  property.name,
                  detail?.gender ? (detail.gender === 'male' ? 'Male' : 'Female') : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
          </View>
          {telUrl(phone) || mailUrl(detail?.email ?? null) ? (
            <View style={styles.contacts}>
              {telUrl(phone) ? <Contact kind="call" label="Call" onPress={() => open(telUrl(phone))} /> : null}
              {whatsAppUrl(phone) ? <Contact kind="whatsapp" label="Message on WhatsApp" onPress={() => open(whatsAppUrl(phone))} /> : null}
              {mailUrl(detail?.email ?? null) ? <Contact kind="mail" label="Email" onPress={() => open(mailUrl(detail?.email ?? null))} /> : null}
            </View>
          ) : (
            <Text style={styles.small}>{added ? 'No contact details stored.' : 'This tenant joined with an invite code; no phone or email is stored.'}</Text>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.spread}>
            <Text style={styles.sectionLabel}>Rent overview{latest ? ` · ${formatPeriod(latest.charge.period)}` : ''}</Text>
            {latest ? <StatusBadge status={latest.status} daysOverdue={latest.daysOverdue} /> : null}
          </View>
          {!rentReady ? (
            charges.isError || payments.isError ? (
              <View style={styles.gap}>
                <Text style={styles.error}>Couldn’t load rent records.</Text>
                <AppButton variant="secondary" size="sm" label="Retry" onPress={refresh} style={styles.selfStart} />
              </View>
            ) : (
              <ActivityIndicator color={BrandColors.accent} />
            )
          ) : ledger && ledger.length === 0 ? (
            <Text style={styles.muted}>No rent charge has been added for this tenant yet.</Text>
          ) : (
            <View style={styles.tile}>
              <Text style={styles.tileLabel}>Balance due</Text>
              <Text style={[styles.balance, outstanding ? { color: BrandColors.error } : { color: BrandColors.accent }]}>{formatInr(outstanding ?? 0)}</Text>
              <View style={styles.twoCol}>
                <Tile label="Latest monthly charge" value={latest ? formatInr(latest.charge.amountInr) : '—'} />
                <Tile label="Agreed rent" value={tenant.rentInr !== null ? formatInr(tenant.rentInr) : 'Not set'} />
              </View>
            </View>
          )}
          {/* A deposit already collected is shown under Stay details; here only one still to collect. */}
          {detail?.depositInr != null && !detail.depositCollected ? (
            <Tile label="Security deposit (agreed)" value={formatInr(detail.depositInr)} note="Recorded as agreed, not as collected." />
          ) : null}
        </View>

        <View style={styles.actions}>
          <Action
            icon="notifications-active"
            label="Remind"
            disabled={!reminder}
            onPress={() => {
              sendReminder.reset();
              setRemindOpen(true);
            }}
          />
          <Action icon="receipt-long" label="Rent Ledger" onPress={openLedger} />
          <Action
            icon="swap-horiz"
            label="Change stay"
            disabled={!canChange}
            onPress={() => {
              resetStayErrors();
              setStayOpen(true);
            }}
          />
          <Action
            icon="edit-note"
            label="Edit Tenant"
            disabled={!canEdit}
            onPress={() => {
              update.reset();
              setEditing(true);
            }}
          />
        </View>
        {added && hasStay && !canChange ? <Text style={styles.footnote}>Changing the room needs the tenant to have an app account with a verified email, so they can accept the change.</Text> : null}
        {!reminder ? (
          <Text style={styles.footnote}>
            {!rentReady ? 'Loading rent records…' : opensMs !== null ? `Rent reminders open on ${formatDate(opensMs)}, a week before the due date.` : 'Nothing is due for this tenant, so there is nothing to remind.'}
          </Text>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Stay details</Text>
          {hasStay ? (
            <>
              <Tile label="Property & location" value={property.name} note={[property.location, property.city].filter(Boolean).join(', ') || undefined} />
              <View style={styles.twoCol}>
                <Tile label="Room & bed" value={`Room ${tenant.roomNumber}`} note={tenant.bedLabel ?? undefined} />
                <Tile
                  label="Room category"
                  value={tenant.sharing ? sharingLabel(tenant.sharing) : '—'}
                  note={room ? (room.ac ? 'Air conditioned' : 'Non-AC') : undefined}
                />
              </View>
              {tenant.joinedAtMs !== null ? <Tile label="Move-in date" value={formatDate(tenant.joinedAtMs)} /> : null}
              {detail?.depositInr != null && detail.depositCollected ? <Tile label="Security deposit (collected)" value={formatInr(detail.depositInr)} note="Recorded as received by you." /> : null}
            </>
          ) : (
            <Text style={styles.muted}>
              No active stay. {added ? 'This tenant has no bed on record.' : 'They joined this property with an invite code and have not been given a bed.'}
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Recent payments</Text>
          {payments.isPending ? (
            <ActivityIndicator color={BrandColors.accent} />
          ) : myPayments.length === 0 ? (
            <Text style={styles.muted}>No payments have been recorded for this tenant.</Text>
          ) : (
            <View style={styles.gap}>
              {myPayments.slice(0, 5).map((p) => {
                const charge = charges.data?.find((c) => c.id === p.chargeId);
                return (
                  <View key={p.id} style={styles.payment}>
                    <View style={styles.flex}>
                      <Text numberOfLines={1} style={styles.paymentTitle}>
                        {charge ? `${formatPeriod(charge.period)} rent` : 'Rent payment'}
                      </Text>
                      <Text numberOfLines={1} style={styles.small}>
                        {[formatDate(p.paidMs), PAYMENT_METHODS.find((m) => m.value === p.method)?.label, p.reference].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <Text style={styles.paymentAmount}>{formatInr(p.amountInr)}</Text>
                  </View>
                );
              })}
              {myPayments.length > 5 ? <Text style={styles.small}>Showing the latest 5 of {myPayments.length} payments.</Text> : null}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Emergency contact & documents</Text>
          {detail?.emergencyName && detail.emergencyPhone ? (
            <View style={styles.payment}>
              <View style={styles.flex}>
                <Text style={styles.paymentTitle}>{detail.emergencyName}</Text>
                <Text style={styles.small}>+91 {detail.emergencyPhone}</Text>
              </View>
              {telUrl(detail.emergencyPhone) ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`Call ${detail.emergencyName}`} onPress={() => open(telUrl(detail.emergencyPhone))} style={styles.callButton}>
                  <MaterialIcons name="call" size={18} color={BrandColors.accent} />
                </Pressable>
              ) : null}
            </View>
          ) : (
            <Text style={styles.muted}>No emergency contact stored.</Text>
          )}
          {detail?.address ? <Tile label="Address" value={detail.address} /> : null}
          <Text style={styles.small}>No documents are stored for this tenant, and ID verification is not part of the app yet.</Text>
        </View>
      </AppScrollView>

      <View style={[styles.bar, { paddingBottom: insets.bottom + 10 }]}>
        <View style={styles.flex}>
          <Text style={styles.sectionLabel}>Outstanding</Text>
          <Text style={[styles.outstanding, !outstanding && { color: BrandColors.textPrimary }]}>{outstanding === null ? '—' : formatInr(outstanding)}</Text>
        </View>
        <AppButton
          icon="payments"
          label="Record Payment"
          disabled={!payable}
          onPress={recordPayment}
          accessibilityLabel={payable ? 'Record payment' : 'Record payment (nothing to collect)'}
          style={styles.flex}
        />
      </View>

      {editing && detail && detail.bedId ? (
        <EditTenantSheet
          initial={{
            name: tenant.name,
            phone: detail.phone ?? '',
            email: detail.email ?? '',
            address: detail.address ?? '',
            emergencyName: detail.emergencyName ?? '',
            emergencyPhone: detail.emergencyPhone ?? '',
          }}
          stay={hasStay ? { property: property.name, room: `Room ${tenant.roomNumber}`, bed: tenant.bedLabel ?? '—', rentInr: tenant.rentInr } : null}
          busy={update.isPending}
          submitError={update.isError ? editErrorMessage(update.error) : null}
          onSave={(edit, nameChanged) =>
            update.mutate(
              { edit, nameChanged },
              {
                onSuccess: () => {
                  setEditing(false);
                  setBanner('Tenant details updated.');
                },
              },
            )
          }
          onClose={() => setEditing(false)}
        />
      ) : null}

      {dialog}
      <OptionSheet
        visible={menu}
        title={tenant.name}
        onClose={() => setMenu(false)}
        options={[
          { label: 'Refresh', icon: 'refresh', onPress: refresh },
          // For a tenant entered by hand who has no account (for example, a mistaken entry): frees their bed.
          ...(tenant.source === 'added' && !tenant.accountUid
            ? [{
                label: 'Unassign bed',
                icon: 'person-remove' as const,
                onPress: async () => {
                  const ok = await confirm({
                    title: 'Unassign this bed?',
                    message: `${tenant.name} will be removed from ${property.name} and their bed will be free again. Use this for a tenant added by mistake.`,
                    confirmLabel: 'Unassign bed',
                    destructive: true,
                  });
                  if (!ok) return;
                  remove.mutate(undefined, {
                    onSuccess: goToTenants,
                    onError: (error) =>
                      setBanner(
                        error instanceof ResidentHasRentRecordsError
                          ? 'This tenant has rent records, so their bed can’t be unassigned here. Correct their details instead.'
                          : 'Could not unassign the bed. Check your connection and try again.',
                      ),
                  });
                },
              }]
            : []),
          { label: 'All tenants of this property', icon: 'group', onPress: () => router.push({ pathname: '/owner/properties/[propertyId]/tenants', params: { propertyId: property.id } }) },
        ]}
      />
    </View>
  );
}

function editErrorMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  if (code === 'permission-denied') return 'The changes were not saved. You may not have access, or the tenant-edit rules are not deployed yet.';
  return `The changes were not saved. ${getPropertyErrorMessage(error)}`;
}

// Round icon buttons, the same as on My Stay and the property page: phone and email in the app's
// accent colour, WhatsApp in its green.
function Contact({ kind, label, onPress }: { kind: 'call' | 'whatsapp' | 'mail'; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.contact, kind === 'whatsapp' ? styles.contactWhatsApp : styles.contactAccent, pressed && styles.pressed]}>
      {kind === 'whatsapp' ? <FontAwesome name="whatsapp" size={22} color="#FFFFFF" /> : <MaterialIcons name={kind === 'call' ? 'call' : 'mail'} size={20} color="#FFFFFF" />}
    </Pressable>
  );
}

function Action({ icon, label, onPress, disabled }: { icon: IconName; label: string; onPress?: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityLabel={disabled ? `${label} (not available yet)` : label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.action, disabled && styles.dim, pressed && styles.pressed]}>
      <View style={styles.actionIcon}>
        <MaterialIcons name={icon} size={20} color={BrandColors.accent} />
      </View>
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <View style={[styles.tile, styles.flex]}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>{value}</Text>
      {note ? <Text style={styles.small}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BrandColors.canvas },
  flex: { flex: 1, minWidth: 0 },
  content: { padding: 16, gap: 14, paddingBottom: 24 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  gap: { gap: 8 },
  selfStart: { alignSelf: 'flex-start' },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  muted: { fontSize: 12, color: BrandColors.textSecondary },
  small: { fontSize: 11, color: BrandColors.textSecondary },
  footnote: { fontSize: 11, color: BrandColors.textSecondary },
  error: { fontSize: 12, color: BrandColors.error },
  dim: { opacity: 0.45 },
  pressed: { opacity: 0.85 },
  card: { gap: 12, padding: 16, borderRadius: 16, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F0EE' },
  avatarText: { fontSize: 18, fontWeight: '800', color: BrandColors.textPrimary },
  name: { fontSize: 18, fontWeight: '800', color: BrandColors.textPrimary },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  badgeOn: { backgroundColor: '#E8F0EE' },
  badgeOff: { backgroundColor: BrandColors.canvas },
  badgeText: { fontSize: 11, fontWeight: '700', color: BrandColors.textSecondary },
  contacts: { flexDirection: 'row', gap: 12 },
  contact: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  contactAccent: { backgroundColor: BrandColors.accent },
  contactWhatsApp: { backgroundColor: '#25D366' },
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: BrandColors.textSecondary },
  tile: { gap: 2, padding: 12, borderRadius: 12, backgroundColor: BrandColors.canvas },
  tileLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', color: BrandColors.textSecondary },
  tileValue: { fontSize: 15, fontWeight: '700', color: BrandColors.textPrimary },
  balance: { fontSize: 26, fontWeight: '800' },
  twoCol: { flexDirection: 'row', gap: 8 },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12, borderRadius: 14, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  actionIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F0EE' },
  actionText: { fontSize: 12, fontWeight: '700', color: BrandColors.textPrimary },
  payment: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, backgroundColor: BrandColors.canvas },
  paymentTitle: { fontSize: 14, fontWeight: '700', color: BrandColors.textPrimary },
  paymentAmount: { fontSize: 15, fontWeight: '800', color: BrandColors.textPrimary },
  callButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: BrandColors.surface },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, backgroundColor: '#E8F0EE' },
  bannerText: { flex: 1, fontSize: 13, fontWeight: '600', color: BrandColors.textPrimary },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingTop: 10, backgroundColor: BrandColors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BrandColors.border },
  outstanding: { fontSize: 20, fontWeight: '800', color: BrandColors.error },
});
