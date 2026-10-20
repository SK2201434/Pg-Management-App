import { StyleSheet, Text, View } from 'react-native';

import { BrandColors } from '@/constants/theme';
import type { ChargeStatus } from '@/features/rent/rentModel';

const AMBER = '#9E7231';
const AMBER_BG = '#FDF7EB';

export function statusPresentation(
  status: ChargeStatus,
  daysOverdue: number,
): { label: string; color: string; background: string } {
  switch (status) {
    case 'paid':
      return { label: 'Paid', color: BrandColors.accent, background: '#E8F0EE' };
    case 'partial':
      return { label: 'Partial', color: BrandColors.accent, background: '#E8F0EE' };
    case 'due-today':
      return { label: 'Due today', color: AMBER, background: AMBER_BG };
    case 'overdue':
      return { label: `Overdue (${daysOverdue}d)`, color: BrandColors.error, background: BrandColors.errorTint };
    default:
      return { label: 'Upcoming', color: BrandColors.textSecondary, background: BrandColors.canvas };
  }
}

export function StatusBadge({ status, daysOverdue }: { status: ChargeStatus; daysOverdue: number }) {
  const p = statusPresentation(status, daysOverdue);
  return (
    <View style={[styles.badge, { backgroundColor: p.background }]}>
      <Text style={[styles.badgeText, { color: p.color }]}>{p.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
});
