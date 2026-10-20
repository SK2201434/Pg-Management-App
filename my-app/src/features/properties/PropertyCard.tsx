import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { BrandColors } from '@/constants/theme';
import { propertyBadge } from '@/features/properties/propertyFilter';
import { occupancyPercent, summarizeRooms } from '@/features/properties/propertyDetailsModel';
import { formatRentRange } from '@/features/properties/propertySetup';
import type { Property } from '@/features/properties/propertyTypes';
import { usePropertyRooms } from '@/features/properties/usePropertyQueries';

type PropertyCardProps = {
  property: Property;
  /**
   * Opens the property. Leave it out until a details route exists: the card then renders without
   * the chevron and is not pressable, instead of leading nowhere.
   */
  onPress?: () => void;
  /** Starts capturing the coordinates; shown as a badge while the property has none. */
  onAddLocation?: () => void;
  addingLocation?: boolean;
  /** Why the last capture failed, if it did. */
  locationError?: string;
};

// Property summary: the property document plus its room and bed records (same cached query as the
// details screen). Occupied beds are those held by a resident the owner added; available beds exclude them. There is no active/inactive field;
// the badge is the property's real active/inactive status (or an unfinished setup).
export function PropertyCard({ property, onPress, onAddLocation, addingLocation, locationError }: PropertyCardProps) {
  const rooms = usePropertyRooms(property.id);
  const totals = rooms.data ? summarizeRooms(rooms.data) : null;
  const badgeInfo = propertyBadge(property);
  const ready = badgeInfo.good;

  // Occupied = beds held by a resident (a bed allocation). With no beds there is no percentage.
  const percent = totals ? occupancyPercent(totals.occupiedBeds, totals.totalBeds) : null;

  let stats: React.ReactNode;
  if (rooms.isPending) {
    stats = <Text style={styles.note}>Loading rooms…</Text>;
  } else if (!totals) {
    stats = <Text style={styles.note}>Bed details unavailable</Text>;
  } else if (totals.totalRooms === 0) {
    stats = <Text style={styles.note}>Rooms not configured</Text>;
  } else {
    stats = (
      <>
        <View style={styles.stats}>
          <Stat label="Rooms" value={String(totals.totalRooms)} />
          <Stat label="Beds" value={String(totals.totalBeds)} />
          <Stat label="Occupied" value={String(totals.occupiedBeds)} />
        </View>
        <View style={styles.occupancyHeader}>
          <Text style={styles.statLabel}>Occupancy</Text>
          <Text style={percent === null ? styles.note : styles.percent}>
            {percent === null ? 'No beds yet' : `${percent}%`}
          </Text>
        </View>
        <View style={styles.track}>
          {percent !== null ? <View style={[styles.fill, { width: `${percent}%` }]} /> : null}
        </View>
        <View style={styles.footer}>
          <Text style={styles.available}>
            {totals.availableBeds} {totals.availableBeds === 1 ? 'bed' : 'beds'} available
          </Text>
          <Text style={[styles.note, styles.rent]}>
            {totals.rent ? formatRentRange(totals.rent) : 'Rent not configured'}
          </Text>
        </View>
      </>
    );
  }

  const content = (
    <>
      <View style={styles.icon}>
        {property.coverUrl ? (
          <Image source={{ uri: property.coverUrl }} style={styles.cover} accessibilityLabel={`${property.name} photo`} />
        ) : (
          <MaterialIcons name="apartment" size={24} color={BrandColors.accent} />
        )}
      </View>
      <View style={styles.text}>
        <Text numberOfLines={1} style={styles.name}>
          {property.name}
        </Text>
        <View style={[styles.badge, ready ? styles.badgeReady : styles.badgeDraft]}>
          <Text style={[styles.badgeText, { color: ready ? BrandColors.accent : BrandColors.error }]}>
            {badgeInfo.label}
          </Text>
        </View>
        {property.location ? (
          <View style={styles.locationRow}>
            <MaterialIcons name="location-on" size={15} color={BrandColors.textSecondary} />
            <Text numberOfLines={1} style={styles.location}>
              {property.location}
            </Text>
          </View>
        ) : null}
      </View>
      {onPress ? (
        <MaterialIcons name="chevron-right" size={22} color={BrandColors.textSecondary} />
      ) : null}
    </>
  );
  const statsBlock = <View style={styles.statsBlock}>{stats}</View>;

  const geoBadge =
    !property.hasGeo && onAddLocation ? (
      <View style={styles.geoRow}>
        <AppButton
          variant="secondary"
          size="sm"
          icon="my-location"
          label={addingLocation ? 'Getting location…' : 'Add location coordinates'}
          accessibilityLabel={`Add location coordinates for ${property.name}`}
          loading={addingLocation}
          onPress={onAddLocation}
          style={styles.geoBadge}
        />
        {locationError ? <Text style={styles.geoError}>{locationError}</Text> : null}
      </View>
    ) : null;

  const body = onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${property.name}${property.location ? `, ${property.location}` : ''}`}
      onPress={onPress}
      style={({ pressed }) => [styles.body, pressed && styles.pressed]}>
      <View style={styles.row}>{content}</View>
      {statsBlock}
    </Pressable>
  ) : (
    <View style={styles.body}>
      <View style={styles.row}>{content}</View>
      {statsBlock}
    </View>
  );

  return (
    <View style={styles.card}>
      {body}
      {geoBadge}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 12 },
  statsBlock: { gap: 8 },
  stats: { flexDirection: 'row', padding: 10, borderRadius: 12, backgroundColor: BrandColors.canvas },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 16, fontWeight: '800', color: BrandColors.textPrimary },
  statLabel: { fontSize: 11, textAlign: 'center', color: BrandColors.textSecondary },
  occupancyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  percent: { fontSize: 13, fontWeight: '800', color: BrandColors.accent },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: BrandColors.border },
  fill: { height: '100%', borderRadius: 4, backgroundColor: BrandColors.accent },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  available: { flexShrink: 0, fontSize: 12, fontWeight: '700', color: BrandColors.accent },
  rent: { flex: 1, textAlign: 'right' },
  note: { fontSize: 12, color: BrandColors.textSecondary },
  badge: { alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeReady: { backgroundColor: '#E8F0EE' },
  badgeDraft: { backgroundColor: BrandColors.errorTint },
  badgeText: { fontSize: 11, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  card: {
    gap: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: BrandColors.surface,
    borderWidth: 1,
    borderColor: BrandColors.border,
    elevation: 2,
    shadowColor: BrandColors.textPrimary,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  pressed: { opacity: 0.85 },
  geoRow: { gap: 4 },
  geoBadge: { alignSelf: 'flex-start' },
  geoError: { fontSize: 12, color: BrandColors.error },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF3F1',
    overflow: 'hidden',
  },
  cover: { width: '100%', height: '100%' },
  text: { flex: 1, minWidth: 0 },
  name: { fontSize: 17, fontWeight: '700', color: BrandColors.textPrimary },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  location: { flex: 1, fontSize: 13, color: BrandColors.textSecondary },
});
