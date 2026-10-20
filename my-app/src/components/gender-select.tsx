import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandColors } from '@/constants/theme';
import { GENDERS, type Gender } from '@/constants/account';

type Props = {
  value: Gender | undefined | null;
  onChange: (value: Gender) => void;
  error?: string;
  disabled?: boolean;
  label?: string;
};

// Male / Female choice, shared by Create Account and Add Tenant. Nothing is preselected.
export function GenderSelect({ value, onChange, error, disabled, label = 'Gender' }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row} accessibilityRole="radiogroup">
        {GENDERS.map((g) => {
          const selected = value === g.value;
          return (
            <Pressable
              key={g.value}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: !!disabled }}
              disabled={disabled}
              onPress={() => onChange(g.value)}
              style={[styles.option, selected && styles.optionOn, !!error && !selected && styles.optionError]}>
              <Text style={[styles.optionText, selected && styles.optionTextOn]}>{g.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: BrandColors.textPrimary },
  row: { flexDirection: 'row', gap: 10 },
  option: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: BrandColors.border, backgroundColor: BrandColors.surface },
  optionOn: { backgroundColor: BrandColors.accent, borderColor: BrandColors.accent },
  optionError: { borderColor: BrandColors.error },
  optionText: { fontSize: 14, fontWeight: '700', color: BrandColors.textSecondary },
  optionTextOn: { color: BrandColors.surface },
  error: { fontSize: 12, color: BrandColors.error },
});
