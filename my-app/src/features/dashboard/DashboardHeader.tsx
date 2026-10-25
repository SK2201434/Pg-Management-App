import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandColors } from '@/constants/theme';
import type { OccupancySummary, PropertyOption } from '@/features/dashboard/dashboardTypes';
import { formatCount, formatPercent } from '@/features/dashboard/dashboardFormat';

type HeaderProps = {
  /** "Good morning". */
  greeting: string;
  /** The owner's display name, if the profile has one. */
  name: string | null;
  /** Label of the current scope: "All Properties (3)" or a property name. */
  scopeLabel: string | null;
  onOpenSelector: () => void;
};

// Owner Portal label, personal greeting and the property selector button.
export function DashboardHeader({ greeting, name, scopeLabel, onOpenSelector }: HeaderProps) {
  const firstName = name?.trim().split(/\s+/)[0];
  return (
    <View style={styles.header}>
      <View style={styles.flex}>
        <View style={styles.portal}>
          <View style={styles.portalDot} />
          <Text style={styles.portalText}>Owner Portal</Text>
        </View>
        <Text style={styles.greeting} accessibilityRole="header">
          {firstName ? `${greeting}, ${firstName}` : greeting}
        </Text>
      </View>
      {scopeLabel ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Property: ${scopeLabel}. Change`} onPress={onOpenSelector} style={styles.selector}>
          <MaterialIcons name="domain" size={17} color={BrandColors.accent} />
          <Text numberOfLines={1} style={styles.selectorText}>
            {scopeLabel}
          </Text>
          <MaterialIcons name="keyboard-arrow-down" size={18} color={BrandColors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** The bed strip under the greeting. Nothing is shown until the bed data is real. */
export function CapacityStrip({ occupancy }: { occupancy: OccupancySummary | null }) {
  if (occupancy === null) return null;
  return (
    <View style={styles.strip} accessible accessibilityLabel={occupancy.totalBeds === 0 ? 'No beds set up yet' : `${occupancy.occupiedBeds} of ${occupancy.totalBeds} beds occupied`}>
      <View style={styles.stripLeft}>
        <MaterialIcons name="verified-user" size={16} color={BrandColors.accent} />
        <Text style={styles.stripText}>
          {occupancy.totalBeds === 0 ? 'No beds set up yet' : `${formatCount(occupancy.occupiedBeds)} of ${formatCount(occupancy.totalBeds)} beds occupied`}
        </Text>
      </View>
      {occupancy.totalBeds > 0 ? <Text style={styles.stripPercent}>{formatPercent(occupancy.occupancyPercentage)} capacity</Text> : null}
    </View>
  );
}

type SheetProps = {
  visible: boolean;
  properties: readonly PropertyOption[];
  /** `null` selects "All Properties". */
  selectedId: string | null;
  onSelect: (propertyId: string | null) => void;
  onClose: () => void;
};

// Bottom sheet listing "All Properties" and each of the owner's own properties.
export function PropertySheet({ visible, properties, selectedId, onSelect, onClose }: SheetProps) {
  const insets = useSafeAreaInsets();
  const options: { id: string | null; name: string; sub?: string }[] = [
    ...(properties.length > 1 ? [{ id: null, name: `All Properties (${properties.length})` }] : []),
    ...properties,
  ];
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable accessibilityLabel="Dismiss" style={StyleSheet.absoluteFill} onPress={onClose} />
        <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <MaterialIcons name="apartment" size={20} color={BrandColors.accent} />
            <Text accessibilityRole="header" style={styles.sheetTitle}>
              Select Property
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} onPress={onClose} style={styles.close}>
              <MaterialIcons name="close" size={18} color={BrandColors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView style={styles.options} contentContainerStyle={styles.optionsContent}>
            {options.map((o) => {
              const selected = o.id === selectedId;
              return (
                <Pressable
                  key={o.id ?? 'all'}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    onSelect(o.id);
                    onClose();
                  }}
                  style={[styles.option, selected && styles.optionOn]}>
                  <Text style={[styles.optionText, selected && styles.optionTextOn]}>{o.name}</Text>
                  {selected ? <MaterialIcons name="check" size={20} color={BrandColors.accent} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  portal: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  portalDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BrandColors.accent },
  portalText: { fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: BrandColors.accent },
  greeting: { marginTop: 2, fontSize: 21, fontWeight: '800', color: BrandColors.textPrimary },
  selector: { maxWidth: '48%', minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 12, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  selectorText: { flexShrink: 1, fontSize: 12, fontWeight: '700', color: BrandColors.textPrimary },
  strip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: '#EEF3F1' },
  stripLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  stripText: { flexShrink: 1, fontSize: 12, fontWeight: '600', color: BrandColors.textSecondary },
  stripPercent: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', color: BrandColors.accent },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(32, 42, 43, 0.45)' },
  sheet: { maxHeight: '75%', gap: 8, paddingTop: 8, paddingHorizontal: 16, borderTopLeftRadius: 28, borderTopRightRadius: 20, backgroundColor: BrandColors.surface },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: BrandColors.border },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  sheetTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: BrandColors.textPrimary },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: BrandColors.canvas },
  options: { flexGrow: 0 },
  optionsContent: { gap: 6, paddingBottom: 4 },
  option: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 14, borderRadius: 12 },
  optionOn: { backgroundColor: '#E8F0EE' },
  optionText: { flexShrink: 1, fontSize: 15, fontWeight: '600', color: BrandColors.textPrimary },
  optionTextOn: { fontWeight: '800' },
});
