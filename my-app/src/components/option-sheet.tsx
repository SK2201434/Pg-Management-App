import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandColors } from '@/constants/theme';

export type SheetOption = {
  label: string;
  icon?: ComponentProps<typeof MaterialIcons>['name'];
  onPress: () => void;
};

type OptionSheetProps = {
  visible: boolean;
  title?: string;
  options: readonly SheetOption[];
  onClose: () => void;
};

// Reusable bottom sheet for "pick one of these actions" (e.g. Take a photo / Choose from gallery).
// Choosing an option closes the sheet and then runs it; backdrop tap and Android back close it.
export function OptionSheet({ visible, title, options, onClose }: OptionSheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable accessibilityLabel="Dismiss" style={StyleSheet.absoluteFill} onPress={onClose} />
        <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.handle} />
          {title ? (
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
          ) : null}
          {options.map((option) => (
            <Pressable
              key={option.label}
              accessibilityRole="button"
              android_ripple={{ color: 'rgba(32,42,43,0.08)' }}
              onPress={() => {
                onClose();
                option.onPress();
              }}
              style={styles.option}>
              {option.icon ? <MaterialIcons name={option.icon} size={24} color={BrandColors.accent} /> : null}
              <Text style={styles.optionLabel}>{option.label}</Text>
            </Pressable>
          ))}
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
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
    backgroundColor: BrandColors.border,
  },
  title: { paddingVertical: 8, fontSize: 16, fontWeight: '800', color: BrandColors.textPrimary },
  option: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 12, paddingHorizontal: 4 },
  optionLabel: { fontSize: 16, fontWeight: '600', color: BrandColors.textPrimary },
});
