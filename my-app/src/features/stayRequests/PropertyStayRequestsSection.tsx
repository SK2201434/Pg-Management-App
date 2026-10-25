import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandColors } from '@/constants/theme';
import { useStayRequests } from '@/features/stayRequests/stayRequestsLive';
import { sortStayRequests } from '@/features/stayRequests/stayRequestsModel';

const SNIPPET = 90;

// The stay requests waiting on one property, for its owner. They arrive live; deciding on them
// (approve with a bed, or decline) happens on the Stay requests page, which a tap opens.
export function PropertyStayRequestsSection({ propertyId }: { propertyId: string }) {
  const live = useStayRequests();
  const pending = sortStayRequests(live.items).filter((r) => r.propertyId === propertyId && r.status === 'pending');
  if (pending.length === 0) return null;
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.label}>Stay requests</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{pending.length}</Text>
        </View>
      </View>
      {pending.map((r, i) => (
        <Pressable
          key={r.tenantUid}
          accessibilityRole="button"
          accessibilityLabel={`${r.tenantName} wants to stay. Review request`}
          onPress={() => router.push('/owner/stay-requests')}
          style={[styles.row, i > 0 && styles.divider]}>
          <View style={styles.avatar}>
            <MaterialIcons name="person-add" size={20} color={BrandColors.accent} />
          </View>
          <View style={styles.flex}>
            <Text numberOfLines={1} style={styles.name}>{r.tenantName}</Text>
            <Text numberOfLines={2} style={styles.muted}>
              {r.message ? `“${r.message.length > SNIPPET ? `${r.message.slice(0, SNIPPET).trimEnd()}…` : r.message}”` : 'Wants to stay at this property.'}
            </Text>
          </View>
          <View style={styles.review}>
            <Text style={styles.reviewText}>Review</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10, padding: 16, borderRadius: 16, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  flex: { flex: 1, minWidth: 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: BrandColors.textSecondary },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: BrandColors.errorTint },
  badgeText: { fontSize: 11, fontWeight: '800', color: BrandColors.error },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  divider: { paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BrandColors.border },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F0EE' },
  name: { fontSize: 15, fontWeight: '800', color: BrandColors.textPrimary },
  muted: { fontSize: 13, lineHeight: 19, color: BrandColors.textSecondary },
  review: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: BrandColors.accent },
  reviewText: { fontSize: 11, fontWeight: '800', color: BrandColors.accent },
});
