import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/app-button';
import { AppScrollView } from '@/components/app-scroll-view';
import { GenderSelect } from '@/components/gender-select';
import { OptionSheet } from '@/components/option-sheet';
import { BrandColors } from '@/constants/theme';
import { Field } from '@/features/properties/addProperty/formParts';
import { availableBedCount, parsePropertyId, sortRooms } from '@/features/properties/propertyDetailsModel';
import { getPropertyErrorMessage } from '@/features/properties/propertyService';
import { newKey, sharingLabel } from '@/features/properties/propertySetup';
import type { PropertyRoom } from '@/features/properties/propertyTypes';
import { useOwnerProperties, usePropertyRooms } from '@/features/properties/usePropertyQueries';
import { formatDate, formatInr, parseAmount, startOfDay } from '@/features/rent/rentModel';
import { AddTenantSheet } from '@/features/tenants/AddTenantSheet';
import {
  PHONE_COUNTRY,
  toNewResident,
  validateAddTenant,
  type AddTenantErrors,
  type AddTenantForm,
} from '@/features/tenants/addTenantModel';
import { DateField } from '@/features/tenants/DateField';
import { BedUnavailableError } from '@/features/tenants/residentService';
import { useAddResident } from '@/features/tenants/useAddResident';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

// Add Tenant. Opened with `?propertyId=` from a property's own tenants page (that property is
// preselected) or without it from the global Tenants tab (the owner picks one). The room and bed lists
// are the chosen property's own, with beds already held by a resident left out. Changing the property
// or room clears everything chosen below it, so a stale room or bed can never be submitted.
export function AddTenantScreen() {
  const params = useLocalSearchParams<{ propertyId?: string | string[] }>();
  const presetId = parsePropertyId(params.propertyId);
  const insets = useSafeAreaInsets();
  const properties = useOwnerProperties();
  const list = useMemo(() => properties.data ?? [], [properties.data]);

  const [now] = useState(Date.now);
  const [form, setForm] = useState<AddTenantForm>(() => ({
    name: '',
    gender: null,
    phone: '',
    email: '',
    address: '',
    emergencyName: '',
    emergencyPhone: '',
    propertyId: presetId,
    roomId: null,
    bedId: null,
    rent: '',
    deposit: '',
    moveInMs: startOfDay(now),
  }));
  const [rentTouched, setRentTouched] = useState(false);
  const [errors, setErrors] = useState<AddTenantErrors>({});
  const [pickingProperty, setPickingProperty] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [residentId] = useState(newKey);

  // A preset that is not one of the owner's properties is ignored once they have loaded.
  const propertyId = form.propertyId && list.some((p) => p.id === form.propertyId) ? form.propertyId : null;
  const property = list.find((p) => p.id === propertyId) ?? null;
  const rooms = usePropertyRooms(propertyId);
  const add = useAddResident(propertyId ?? '');

  const sorted = useMemo(() => sortRooms(rooms.data ?? []), [rooms.data]);
  const room = sorted.find((r) => r.id === form.roomId) ?? null;
  const vacantTotal = rooms.data ? rooms.data.reduce((sum, r) => sum + availableBedCount(r), 0) : null;
  const bed = room?.beds.find((b) => b.id === form.bedId) ?? null;

  const set = (patch: Partial<AddTenantForm>) => setForm((f) => ({ ...f, ...patch }));

  const choosePropertyById = (id: string) => {
    if (id === propertyId) return;
    // Everything below the property depends on it.
    set({ propertyId: id, roomId: null, bedId: null, rent: '' });
    setRentTouched(false);
  };
  const chooseRoom = (r: PropertyRoom) => {
    set({
      roomId: r.id,
      bedId: null,
      // The room's per-bed rate is the starting point; a rent the owner typed is kept only while the room stays the same.
      rent: r.rentPerBedInr !== null ? String(r.rentPerBedInr) : '',
    });
    setRentTouched(false);
  };

  const submit = async () => {
    const found = validateAddTenant({ ...form, propertyId }, now);
    setErrors(found);
    if (Object.keys(found).length > 0 || !propertyId || !room || !bed || add.isPending) return;
    try {
      await add.mutateAsync({
        ...toNewResident(form),
        residentId,
        roomId: room.id,
        bedId: bed.id,
        roomNumber: room.roomNumber,
        bedLabel: bed.label,
        sharing: room.sharing,
      });
      setDone(`${form.name.trim()} was added to Room ${room.roomNumber}, ${bed.label}.`);
    } catch (error) {
      if (error instanceof BedUnavailableError) {
        set({ bedId: null });
        rooms.refetch();
      }
    }
  };

  const header = <Stack.Screen options={{ title: 'Add Tenant', headerTitle: 'Add a resident to your property' }} />;

  if (done) {
    return (
      <AppScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {header}
        <View style={styles.success}>
          <MaterialIcons name="check-circle" size={40} color={BrandColors.accent} />
          <Text style={styles.successTitle}>Tenant added</Text>
          <Text style={styles.successText}>{done}</Text>
          <AppButton label="Done" onPress={() => router.back()} style={styles.stretch} />
        </View>
      </AppScrollView>
    );
  }

  if (properties.isPending) {
    return (
      <View style={[styles.screen, styles.center]}>
        {header}
        <ActivityIndicator color={BrandColors.accent} />
        <Text style={styles.muted}>Loading your properties…</Text>
      </View>
    );
  }
  if (properties.isError) {
    return (
      <AppScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {header}
        <Notice icon="error-outline" title="Couldn’t load your properties" message={getPropertyErrorMessage(properties.error)} actionLabel="Retry" onAction={() => properties.refetch()} />
      </AppScrollView>
    );
  }
  if (list.length === 0) {
    return (
      <AppScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {header}
        <Notice icon="apartment" title="Add a property first" message="A tenant is placed in a bed of a property, so create a property with rooms and beds before adding tenants." actionLabel="Add property" onAction={() => router.replace('/owner/add-property')} />
      </AppScrollView>
    );
  }

  return (
    <View style={styles.screen}>
      {header}
      <AppScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <View style={styles.banner}>
          <View style={styles.bannerIcon}>
            <MaterialIcons name="apartment" size={20} color={BrandColors.accent} />
          </View>
          <View style={styles.flex}>
            <Text numberOfLines={1} style={styles.bannerTitle}>
              {property ? property.name : 'Choose a property'}
            </Text>
            <Text numberOfLines={1} style={styles.muted}>
              {property
                ? [property.location, vacantTotal !== null ? `${vacantTotal} ${vacantTotal === 1 ? 'bed' : 'beds'} vacant` : rooms.isPending ? 'Checking vacancy…' : null].filter(Boolean).join(' · ')
                : 'Tenants are added to one property at a time'}
            </Text>
          </View>
          {list.length > 1 || !property ? (
            <Pressable accessibilityRole="button" accessibilityLabel={property ? 'Change property' : 'Choose property'} onPress={() => setPickingProperty(true)} hitSlop={8}>
              <Text style={styles.link}>{property ? 'Change' : 'Choose'}</Text>
            </Pressable>
          ) : null}
        </View>
        {errors.property ? <Text style={styles.error}>{errors.property}</Text> : null}

        <Card icon="person" title="Personal details">
          <Field label="Full name" value={form.name} onChangeText={(name) => set({ name })} maxLength={100} autoCapitalize="words" placeholder="e.g. Rahul Sharma" error={errors.name} />
          <GenderSelect value={form.gender} onChange={(gender) => set({ gender })} error={errors.gender} />
          <View style={styles.phoneRow}>
            <View style={styles.countryBox} accessible accessibilityLabel={`Country code ${PHONE_COUNTRY}`}>
              <Text style={styles.countryText}>{PHONE_COUNTRY}</Text>
            </View>
            <View style={styles.flex}>
              <Field label="Phone number" value={form.phone} onChangeText={(phone) => set({ phone })} keyboardType="phone-pad" maxLength={12} placeholder="98765 43210" error={errors.phone} hint="Not verified by HOSTELL." />
            </View>
          </View>
          <Field label="Email address" optional value={form.email} onChangeText={(email) => set({ email })} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} maxLength={120} error={errors.email} />
          <Field label="Permanent / current address" optional value={form.address} onChangeText={(address) => set({ address })} maxLength={200} />
          <View style={styles.emergency}>
            <Text style={styles.sectionLabel}>Emergency contact (recommended)</Text>
            <Field label="Contact name" optional value={form.emergencyName} onChangeText={(emergencyName) => set({ emergencyName })} maxLength={100} placeholder="e.g. Suresh Sharma (Father)" error={errors.emergency} />
            <Field label="Contact phone" optional value={form.emergencyPhone} onChangeText={(emergencyPhone) => set({ emergencyPhone })} keyboardType="phone-pad" maxLength={12} error={errors.emergencyPhone} />
          </View>
        </Card>

        <Card icon="meeting-room" title="Stay details">
          <Pressable accessibilityRole="button" accessibilityLabel="Property" onPress={() => setPickingProperty(true)} style={[styles.select, !!errors.property && styles.selectError]}>
            <View style={styles.flex}>
              <Text style={styles.selectLabel}>Property</Text>
              <Text style={styles.selectValue}>{property ? property.name : 'Choose a property'}</Text>
            </View>
            <MaterialIcons name="unfold-more" size={20} color={BrandColors.textSecondary} />
          </Pressable>

          <Text style={styles.label}>Room</Text>
          {!property ? (
            <Text style={styles.muted}>Choose a property first.</Text>
          ) : rooms.isPending ? (
            <ActivityIndicator color={BrandColors.accent} />
          ) : rooms.isError ? (
            <View style={styles.gap}>
              <Text style={styles.error}>{getPropertyErrorMessage(rooms.error)}</Text>
              <AppButton variant="secondary" size="sm" label="Retry" onPress={() => rooms.refetch()} style={styles.selfStart} />
            </View>
          ) : sorted.length === 0 ? (
            <Text style={styles.muted}>This property has no rooms yet. Add rooms in Rooms & Beds first.</Text>
          ) : (
            <View style={styles.gap}>
              {sorted.map((r) => {
                const vacant = availableBedCount(r);
                const selected = r.id === form.roomId;
                return (
                  <Pressable
                    key={r.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected, disabled: vacant === 0 }}
                    disabled={vacant === 0}
                    onPress={() => chooseRoom(r)}
                    style={[styles.roomOption, selected && styles.optionOn, vacant === 0 && styles.dim]}>
                    <View style={styles.flex}>
                      <Text style={styles.optionTitle}>Room {r.roomNumber}</Text>
                      <Text style={styles.muted}>
                        {[r.sharing > 0 ? sharingLabel(r.sharing) : null, r.ac ? 'AC' : 'Non-AC', r.rentPerBedInr !== null ? `${formatInr(r.rentPerBedInr)}/bed` : null].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <Text style={vacant > 0 ? styles.vacant : styles.muted}>{vacant > 0 ? `${vacant} vacant` : 'Full'}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          {errors.room ? <Text style={styles.error}>{errors.room}</Text> : null}

          <View style={styles.spread}>
            <Text style={styles.label}>Bed</Text>
            {bed ? (
              <View style={styles.available}>
                <MaterialIcons name="check-circle" size={13} color={BrandColors.accent} />
                <Text style={styles.availableText}>Available</Text>
              </View>
            ) : null}
          </View>
          {!room ? (
            <Text style={styles.muted}>Choose a room to see its beds.</Text>
          ) : (
            <View style={styles.chips}>
              {room.beds.map((b) => {
                const free = b.status === 'available' && b.occupant === null;
                const selected = b.id === form.bedId;
                return (
                  <Pressable
                    key={b.id}
                    accessibilityRole="radio"
                    accessibilityLabel={`${b.label}${free ? ', vacant' : b.occupant !== null ? ', occupied' : ', unavailable'}`}
                    accessibilityState={{ selected, disabled: !free }}
                    disabled={!free}
                    onPress={() => set({ bedId: b.id })}
                    style={[styles.bedChip, selected && styles.optionOn, !free && styles.dim]}>
                    <Text style={[styles.bedText, selected && styles.bedTextOn]}>{b.label}</Text>
                    <Text style={[styles.bedSub, selected && styles.bedTextOn]}>{free ? 'Vacant' : b.occupant !== null ? 'Occupied' : 'Unavailable'}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          {errors.bed ? <Text style={styles.error}>{errors.bed}</Text> : null}
          {room ? <Text style={styles.muted}>Only vacant beds can be chosen. Occupied and blocked beds are disabled.</Text> : null}

          <View style={styles.twoCol}>
            <View style={styles.flex}>
              <Field
                label="Monthly rent (₹)"
                value={form.rent}
                onChangeText={(rent) => {
                  set({ rent });
                  setRentTouched(true);
                }}
                keyboardType="number-pad"
                maxLength={9}
                error={errors.rent}
                hint={room && !rentTouched && room.rentPerBedInr !== null ? 'The room’s rate' : room && room.rentPerBedInr === null ? 'This room has no rate set' : undefined}
              />
            </View>
            <View style={styles.flex}>
              <DateField label="Move-in date" valueMs={form.moveInMs} onChange={(moveInMs) => set({ moveInMs })} error={errors.moveIn} />
            </View>
          </View>
          <Field label="Security deposit (₹)" optional value={form.deposit} onChangeText={(deposit) => set({ deposit })} keyboardType="number-pad" maxLength={10} error={errors.deposit} hint="The agreed amount. It is not recorded as collected." />
        </Card>

        <Card icon="description" title="Documents">
          <View style={styles.docs}>
            <MaterialIcons name="cloud-off" size={22} color={BrandColors.textSecondary} />
            <Text style={styles.muted}>
              ID uploads are not available yet. They need private storage that only the owner can read, which is not set up. You can add the tenant now.
            </Text>
          </View>
        </Card>

        <View style={styles.summary} accessibilityLiveRegion="polite">
          <MaterialIcons name="verified" size={22} color={BrandColors.accent} />
          <Text style={styles.summaryText}>
            {property && room && bed
              ? `${form.name.trim() || 'The tenant'} will be added to ${property.name}, Room ${room.roomNumber}, ${bed.label}, at ${parseAmount(form.rent) !== null ? formatInr(parseAmount(form.rent) as number) : 'a rent you enter'} a month, moving in on ${formatDate(form.moveInMs)}. No invitation or SMS is sent.`
              : 'Choose a property, room and vacant bed to see the allocation summary.'}
          </Text>
        </View>

        <Pressable accessibilityRole="button" onPress={() => setInviting(true)} style={styles.inviteLink}>
          <Text style={styles.link}>Or invite a tenant to sign up with a code</Text>
        </Pressable>
        {add.isError ? <Text style={styles.error}>{saveErrorMessage(add.error)}</Text> : null}
      </AppScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
        <AppButton label="Add Tenant" loading={add.isPending} onPress={submit} />
        <AppButton variant="ghost" label="Cancel" disabled={add.isPending} onPress={() => router.back()} />
      </View>

      <OptionSheet
        visible={pickingProperty}
        title="Choose a property"
        onClose={() => setPickingProperty(false)}
        options={list.map((p) => ({ label: p.name, icon: 'apartment' as const, onPress: () => choosePropertyById(p.id) }))}
      />
      {inviting ? <AddTenantSheet properties={list} initialPropertyId={propertyId} onClose={() => setInviting(false)} /> : null}
    </View>
  );
}

function saveErrorMessage(error: unknown): string {
  if (error instanceof BedUnavailableError) return 'That bed was just taken or blocked. Choose another bed.';
  const code = (error as { code?: string } | null)?.code;
  if (code === 'permission-denied') {
    return 'The tenant was not saved. The bed may have just been taken, or the tenant rules are not deployed yet.';
  }
  return `The tenant was not saved. ${getPropertyErrorMessage(error)}`;
}

function Card({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <MaterialIcons name={icon} size={20} color={BrandColors.accent} />
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Notice({ icon, title, message, actionLabel, onAction }: { icon: IconName; title: string; message: string; actionLabel: string; onAction: () => void }) {
  return (
    <View style={styles.notice}>
      <MaterialIcons name={icon} size={28} color={BrandColors.textSecondary} />
      <Text style={styles.noticeTitle}>{title}</Text>
      <Text style={styles.noticeText}>{message}</Text>
      <AppButton label={actionLabel} onPress={onAction} style={styles.stretch} />
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
  stretch: { alignSelf: 'stretch' },
  muted: { fontSize: 12, color: BrandColors.textSecondary },
  error: { fontSize: 12, color: BrandColors.error },
  link: { fontSize: 13, fontWeight: '700', color: BrandColors.accent },
  dim: { opacity: 0.45 },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  bannerIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F0EE' },
  bannerTitle: { fontSize: 14, fontWeight: '800', color: BrandColors.textPrimary },
  card: { gap: 12, padding: 16, borderRadius: 16, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: BrandColors.textPrimary },
  phoneRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  countryBox: { marginTop: 25, minHeight: 46, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: BrandColors.canvas },
  countryText: { fontSize: 14, fontWeight: '700', color: BrandColors.textPrimary },
  emergency: { gap: 10, padding: 12, borderRadius: 12, backgroundColor: BrandColors.canvas },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: BrandColors.textSecondary },
  select: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: BrandColors.border },
  selectError: { borderColor: BrandColors.error },
  selectLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', color: BrandColors.textSecondary },
  selectValue: { marginTop: 2, fontSize: 15, fontWeight: '600', color: BrandColors.textPrimary },
  label: { fontSize: 13, fontWeight: '600', color: BrandColors.textPrimary },
  roomOption: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: BrandColors.border, backgroundColor: BrandColors.surface },
  optionOn: { borderColor: BrandColors.accent, backgroundColor: '#E8F0EE' },
  optionTitle: { fontSize: 14, fontWeight: '700', color: BrandColors.textPrimary },
  vacant: { fontSize: 12, fontWeight: '700', color: BrandColors.accent },
  available: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: '#E8F0EE' },
  availableText: { fontSize: 11, fontWeight: '700', color: BrandColors.accent },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bedChip: { minWidth: 92, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: BrandColors.border, backgroundColor: BrandColors.surface },
  bedText: { fontSize: 14, fontWeight: '700', color: BrandColors.textPrimary },
  bedSub: { fontSize: 11, color: BrandColors.textSecondary },
  bedTextOn: { color: BrandColors.textPrimary },
  twoCol: { flexDirection: 'row', gap: 10 },
  docs: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, backgroundColor: BrandColors.canvas },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, backgroundColor: '#E8F0EE' },
  summaryText: { flex: 1, fontSize: 13, lineHeight: 19, color: BrandColors.textPrimary },
  inviteLink: { alignItems: 'center', paddingVertical: 4 },
  footer: { gap: 4, paddingHorizontal: 16, paddingTop: 10, backgroundColor: BrandColors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BrandColors.border },
  success: { alignItems: 'center', gap: 8, padding: 28, borderRadius: 16, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  successTitle: { fontSize: 18, fontWeight: '800', color: BrandColors.textPrimary },
  successText: { textAlign: 'center', fontSize: 14, color: BrandColors.textSecondary },
  notice: { alignItems: 'center', gap: 8, padding: 28, borderRadius: 16, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  noticeTitle: { fontSize: 16, fontWeight: '700', color: BrandColors.textPrimary },
  noticeText: { textAlign: 'center', fontSize: 13, color: BrandColors.textSecondary },
});
