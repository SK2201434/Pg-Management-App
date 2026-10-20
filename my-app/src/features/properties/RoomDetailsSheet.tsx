import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandColors } from '@/constants/theme';
import { availableBedCount } from '@/features/properties/propertyDetailsModel';
import { floorLabel, formatInr, sharingLabel } from '@/features/properties/propertySetup';
import type { PropertyRoom } from '@/features/properties/propertyTypes';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

// Room details with one row per real bed record. There is no tenant allocation yet, so a bed is
// either vacant (`available`) or blocked by the owner (`unavailable`); no tenant, payment or due
// date is ever shown. Actions whose destination does not exist are disabled with the reason.
export function RoomDetailsSheet({ room, propertyId, onClose }: { room: PropertyRoom | null; propertyId: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={room !== null} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable accessibilityLabel="Dismiss" style={StyleSheet.absoluteFill} onPress={onClose} />
        {room ? (
          <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <View style={styles.badge}>
                <Text numberOfLines={1} adjustsFontSizeToFit style={styles.badgeText}>
                  {room.roomNumber}
                </Text>
              </View>
              <View style={styles.headerText}>
                <Text numberOfLines={1} accessibilityRole="header" style={styles.title}>
                  {room.sharing > 0 ? sharingLabel(room.sharing) : 'Room'} ({room.ac ? 'AC' : 'Non-AC'})
                </Text>
                <Text numberOfLines={1} style={styles.subtitle}>
                  {[
                    room.floor !== null ? floorLabel(room.floor) : null,
                    room.rentPerBedInr !== null ? `${formatInr(room.rentPerBedInr)} / bed` : 'Rent not configured',
                  ]
                    .filter(Boolean)
                    .join(' • ')}
                </Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} onPress={onClose} style={styles.close}>
                <MaterialIcons name="close" size={20} color={BrandColors.textPrimary} />
              </Pressable>
            </View>

            <Text style={styles.sectionLabel}>Bed allocation</Text>
            <ScrollView style={styles.beds} contentContainerStyle={styles.bedsContent}>
              {room.beds.length === 0 ? (
                <Text style={styles.muted}>No beds are configured for this room.</Text>
              ) : (
                room.beds.map((bed) => <BedRow key={bed.id} label={bed.label} status={bed.status} occupant={bed.occupant} onAssign={() => { onClose(); router.push({ pathname: '/owner/add-tenant', params: { propertyId } }); }} />)
              )}
              {room.beds.length > 0 && room.beds.length !== room.sharing ? (
                <Text style={styles.warn}>
                  This room is set up for {room.sharing} beds but has {room.beds.length} bed record
                  {room.beds.length === 1 ? '' : 's'}.
                </Text>
              ) : null}
              <Text style={styles.muted}>
                {availableBedCount(room)} of {room.beds.length} bed{room.beds.length === 1 ? '' : 's'} available.
              </Text>
            </ScrollView>

            <View style={styles.actions}>
              <Action icon="receipt-long" label="View Ledger" />
              <Action icon="tune" label="Manage Room" />
            </View>
            <Text style={styles.muted}>View Ledger and Manage Room are not available yet.</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function BedRow({ label, status, occupant, onAssign }: { label: string; status: 'available' | 'unavailable'; occupant: string | null; onAssign: () => void }) {
  const vacant = status === 'available' && occupant === null;
  return (
    <View style={[styles.bedRow, vacant && styles.bedRowVacant]}>
      <View style={[styles.bedDot, { backgroundColor: vacant ? BrandColors.accent : BrandColors.textSecondary }]}>
        <MaterialIcons name="bed" size={14} color={BrandColors.surface} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.bedName}>{label}</Text>
        <Text style={vacant ? styles.vacant : styles.muted}>{vacant ? 'Vacant bed' : occupant !== null ? `Occupied by ${occupant}` : 'Unavailable'}</Text>
      </View>
      {vacant ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Add a tenant to ${label}`}
          onPress={onAssign}
          style={styles.assign}>
          <Text style={styles.assignText}>Add Tenant</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Action({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View accessibilityRole="button" accessibilityState={{ disabled: true }} style={styles.action}>
      <MaterialIcons name={icon} size={18} color={BrandColors.textSecondary} />
      <Text style={styles.actionText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(32, 42, 43, 0.45)' },
  sheet: {
    maxHeight: '85%',
    gap: 10,
    paddingTop: 8,
    paddingHorizontal: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: BrandColors.surface,
  },
  flex: { flex: 1, minWidth: 0 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: BrandColors.border },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, backgroundColor: BrandColors.accent },
  badgeText: { fontSize: 14, fontWeight: '800', color: BrandColors.surface },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, fontWeight: '800', color: BrandColors.textPrimary },
  subtitle: { marginTop: 1, fontSize: 12, color: BrandColors.textSecondary },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: BrandColors.canvas },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: BrandColors.textSecondary },
  beds: { flexGrow: 0 },
  bedsContent: { gap: 8 },
  bedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, backgroundColor: BrandColors.canvas },
  bedRowVacant: { backgroundColor: '#E8F0EE' },
  bedDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  bedName: { fontSize: 14, fontWeight: '700', color: BrandColors.textPrimary },
  vacant: { fontSize: 12, fontWeight: '600', color: BrandColors.accent },
  muted: { fontSize: 12, color: BrandColors.textSecondary },
  warn: { fontSize: 12, fontWeight: '600', color: BrandColors.error },
  assign: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: BrandColors.accent },
  assignText: { fontSize: 11, fontWeight: '700', color: BrandColors.surface },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, backgroundColor: BrandColors.canvas, opacity: 0.7 },
  actionText: { fontSize: 14, fontWeight: '700', color: BrandColors.textSecondary },
});
