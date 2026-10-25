import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BrandColors } from '@/constants/theme';
import { CATEGORY_LABEL, formatPosted, type TenantUpdate, type UpdateCategory } from '@/features/tenantHome/updatesModel';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

const CATEGORY_ICON: Record<UpdateCategory, IconName> = { important: 'priority-high', notice: 'campaign', maintenance: 'build' };

// One update, shared by the Latest Updates page (list) and the Home swiper.
export function UpdateCard({ update, now }: { update: TenantUpdate; now: number }) {
  return (
    <View style={[styles.card, !update.read && styles.cardUnread]}>
      <View style={styles.row}>
        <View style={styles.iconBox}>
          <MaterialIcons name={CATEGORY_ICON[update.category]} size={20} color={BrandColors.accent} />
        </View>
        <View style={[styles.row, styles.flex]}>
          <Text style={styles.categoryBadge}>{CATEGORY_LABEL[update.category]}</Text>
          {!update.read ? <Text style={styles.newTag}>New</Text> : null}
        </View>
      </View>
      <Text style={styles.rowTitle}>{update.title}</Text>
      <Text numberOfLines={2} style={styles.muted}>{update.message}</Text>
      <View style={[styles.row, styles.spread]}>
        <Text style={styles.muted}>{formatPosted(update.createdMs, now)}</Text>
        {update.publisher ? <Text numberOfLines={1} style={styles.muted}>{update.publisher}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  spread: { justifyContent: 'space-between' },
  rowTitle: { fontSize: 15, fontWeight: '700', color: BrandColors.textPrimary },
  muted: { fontSize: 13, lineHeight: 19, color: BrandColors.textSecondary },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F0EE' },
  card: { gap: 8, padding: 16, borderRadius: 16, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  cardUnread: { backgroundColor: '#F1F7F5', borderColor: BrandColors.accent },
  categoryBadge: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', color: BrandColors.textSecondary },
  newTag: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', color: BrandColors.accent },
});
