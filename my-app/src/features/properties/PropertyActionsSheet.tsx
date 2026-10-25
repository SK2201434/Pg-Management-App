import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandColors } from '@/constants/theme';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

export type PropertyAction = {
  label: string;
  icon: IconName;
  destructive?: boolean;
  /** Why the action cannot be used. Shown under the label; an action with a reason is not pressable. */
  unavailableReason?: string;
  onPress?: () => void;
};

type Props = {
  visible: boolean;
  title: string;
  subtitle: string;
  actions: readonly PropertyAction[];
  onClose: () => void;
};

// Bottom sheet of the Property Details screen. Actions the app cannot perform yet stay visible but
// disabled with the reason, rather than being hidden or pretending to work.
export function PropertyActionsSheet({ visible, title, subtitle, actions, onClose }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable accessibilityLabel="Dismiss" style={StyleSheet.absoluteFill} onPress={onClose} />
        <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text numberOfLines={1} accessibilityRole="header" style={styles.title}>
                {title}
              </Text>
              <Text numberOfLines={1} style={styles.subtitle}>
                {subtitle}
              </Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} onPress={onClose} style={styles.close}>
              <MaterialIcons name="close" size={20} color={BrandColors.textPrimary} />
            </Pressable>
          </View>
          {actions.map((action) => {
            const disabled = !!action.unavailableReason || !action.onPress;
            const color = disabled
              ? BrandColors.textSecondary
              : action.destructive
                ? BrandColors.error
                : BrandColors.textPrimary;
            return (
              <Pressable
                key={action.label}
                accessibilityRole="button"
                accessibilityState={{ disabled }}
                disabled={disabled}
                android_ripple={{ color: 'rgba(32,42,43,0.08)' }}
                onPress={() => {
                  onClose();
                  action.onPress?.();
                }}
                style={[styles.row, disabled && styles.disabled]}>
                <View style={[styles.rowIcon, action.destructive && !disabled && styles.rowIconDanger]}>
                  <MaterialIcons name={action.icon} size={20} color={color} />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowLabel, { color }]}>{action.label}</Text>
                  {action.unavailableReason ? <Text style={styles.reason}>{action.unavailableReason}</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(32, 42, 43, 0.45)' },
  sheet: {
    gap: 4,
    paddingTop: 8,
    paddingHorizontal: 16,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: BrandColors.surface,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 8, backgroundColor: BrandColors.border },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 8 },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontSize: 17, fontWeight: '800', color: BrandColors.textPrimary },
  subtitle: { marginTop: 1, fontSize: 12, color: BrandColors.textSecondary },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: BrandColors.canvas },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 },
  disabled: { opacity: 0.75 },
  rowIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: BrandColors.canvas },
  rowIconDanger: { backgroundColor: BrandColors.errorTint },
  rowText: { flex: 1, minWidth: 0 },
  rowLabel: { fontSize: 15, fontWeight: '700' },
  reason: { marginTop: 1, fontSize: 12, color: BrandColors.textSecondary },
});
