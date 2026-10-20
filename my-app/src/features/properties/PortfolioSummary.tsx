import { StyleSheet, Text, View } from 'react-native';

import { BrandColors } from '@/constants/theme';
import type { PortfolioOccupancy } from '@/features/properties/propertyTypes';

// Total / Occupied / Available beds. `occupancy` must come from real room and bed records; until
// the Room and Bed module exists the screen passes `null` and a restrained note is shown instead
// of zeros that would read as confirmed totals.
export function PortfolioSummary({ occupancy }: { occupancy: PortfolioOccupancy | null }) {
  if (occupancy === null) {
    return (
      <View style={styles.note}>
        <Text style={styles.noteText}>Bed totals will appear here once rooms and beds are set up.</Text>
      </View>
    );
  }
  const { totalBeds, occupiedBeds } = occupancy;
  const percent = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 1000) / 10 : 0;
  return (
    <View style={styles.strip}>
      <Metric label="Total" value={String(totalBeds)} unit="Beds" />
      <Metric label="Occupied" value={String(occupiedBeds)} unit={`${percent}%`} accent />
      <Metric label="Available" value={String(totalBeds - occupiedBeds)} unit="Free" />
    </View>
  );
}

function Metric({ label, value, unit, accent }: { label: string; value: string; unit: string; accent?: boolean }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>
        {value} <Text style={[styles.unit, accent && styles.unitAccent]}>{unit}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    borderRadius: 14,
    backgroundColor: BrandColors.surface,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  metric: { flex: 1, paddingHorizontal: 6 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: BrandColors.textSecondary },
  value: { marginTop: 2, fontSize: 18, fontWeight: '700', color: BrandColors.textPrimary },
  unit: { fontSize: 12, fontWeight: '500', color: BrandColors.textSecondary },
  unitAccent: { color: BrandColors.accent },
  note: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: BrandColors.surface,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  noteText: { fontSize: 13, color: BrandColors.textSecondary },
});
