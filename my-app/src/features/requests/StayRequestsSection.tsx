import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandColors } from '@/constants/theme';
import { REQUEST_LABEL, type StayRequestStatus } from '@/features/discovery/discoveryModel';
import type { MyStayRequestView } from '@/features/discovery/useMyStayRequestViews';
import { formatSubmitted } from '@/features/requests/requestsModel';

const TONE: Record<StayRequestStatus, { fg: string; bg: string; icon: React.ComponentProps<typeof MaterialIcons>['name'] }> = {
  pending: { fg: '#9E7231', bg: '#FDF7EB', icon: 'hourglass-top' },
  approved: { fg: '#38775B', bg: '#EDF6F1', icon: 'check-circle' },
  rejected: { fg: BrandColors.error, bg: BrandColors.errorTint, icon: 'cancel' },
  withdrawn: { fg: BrandColors.textSecondary, bg: '#F1F1EC', icon: 'undo' },
};

const HINT: Record<StayRequestStatus, string> = {
  pending: 'Waiting for the owner to respond.',
  approved: 'The owner approved it. They will assign your bed and add you to the property.',
  rejected: 'The owner could not accept this request.',
  withdrawn: 'You withdrew this request.',
};

// One stay request; tapping it opens that property.
export function StayRequestCard({ request: r }: { request: MyStayRequestView }) {
  const tone = TONE[r.status];
  return (
    <Pressable
      key={r.propertyId}
      accessibilityRole="button"
      accessibilityLabel={`Stay request${r.propertyName ? ` for ${r.propertyName}` : ''}, ${REQUEST_LABEL[r.status]}`}
      onPress={() => router.push({ pathname: '/tenant/discover/[propertyId]', params: { propertyId: r.propertyId } })}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: tone.bg }]}>
          <MaterialIcons name={tone.icon} size={20} color={tone.fg} />
        </View>
        <View style={styles.flex}>
          <Text numberOfLines={1} style={styles.title}>{r.propertyName ?? 'A property'}</Text>
          <Text style={styles.muted}>{formatSubmitted(r.updatedMs ?? r.createdMs) ?? 'Sending…'}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: tone.bg }]}>
          <Text style={[styles.badgeText, { color: tone.fg }]}>{REQUEST_LABEL[r.status]}</Text>
        </View>
      </View>
      {r.message ? <Text numberOfLines={2} style={styles.muted}>Your message: {r.message}</Text> : null}
      <Text style={styles.muted}>{HINT[r.status]}</Text>
    </Pressable>
  );
}

// The tenant's requests to stay at properties (not maintenance tickets). They update live when the
// owner decides, and tapping one opens that property.
export function StayRequestsSection({ items }: { items: readonly MyStayRequestView[] }) {
  if (items.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.label}>Stay requests</Text>
      {items.map((r) => (
        <StayRequestCard key={r.propertyId} request={r} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: BrandColors.textSecondary },
  card: { gap: 8, padding: 16, borderRadius: 16, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  pressed: { opacity: 0.9 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1, minWidth: 0 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '800', color: BrandColors.textPrimary },
  muted: { fontSize: 13, lineHeight: 19, color: BrandColors.textSecondary },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '800' },
});
