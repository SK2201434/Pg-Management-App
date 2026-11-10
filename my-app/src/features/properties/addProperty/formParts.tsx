import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { useScrollToError } from '@/components/form-error-scroll';
import { BrandColors } from '@/constants/theme';

type FieldProps = ComponentProps<typeof TextInput> & {
  label: string;
  error?: string;
  optional?: boolean;
  hint?: string;
  /** Small tappable text at the right end of the label row. */
  labelAction?: { label: string; onPress: () => void; busy?: boolean };
};

export function Field({ label, error, optional, hint, labelAction, style, ...input }: FieldProps) {
  const anchor = useScrollToError(error);
  return (
    <View ref={anchor} collapsable={false} style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>
          {label}
          {optional ? <Text style={styles.optional}> (optional)</Text> : null}
        </Text>
        {labelAction ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={labelAction.label}
            accessibilityState={{ busy: !!labelAction.busy, disabled: !!labelAction.busy }}
            disabled={labelAction.busy}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 0 }}
            onPress={labelAction.onPress}>
            <Text style={styles.labelAction}>{labelAction.busy ? 'Locating…' : labelAction.label}</Text>
          </Pressable>
        ) : null}
      </View>
      <TextInput
        {...input}
        accessibilityLabel={label}
        placeholderTextColor={BrandColors.textSecondary}
        style={[styles.input, input.multiline && styles.multiline, error ? styles.inputError : null, style]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Card({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <View style={styles.card}>
      {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

type ChipProps = { label: string; selected: boolean; onPress: () => void };

export function Chip({ label, selected, onPress }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

type ButtonProps = { label: string; onPress: () => void; disabled?: boolean; icon?: ComponentProps<typeof MaterialIcons>['name'] };

export function PrimaryButton(props: ButtonProps) {
  return <AppButton variant="primary" {...props} />;
}

export function SecondaryButton(props: ButtonProps) {
  return <AppButton variant="secondary" {...props} />;
}

/** Small round +/- control for counts. */
export function CountStepper({
  value,
  min,
  max,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  label: string;
}) {
  return (
    <View style={styles.stepper} accessibilityLabel={`${label}: ${value}`}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${label}`}
        disabled={value <= min}
        onPress={() => onChange(value - 1)}
        style={[styles.stepButton, value <= min && styles.disabled]}>
        <MaterialIcons name="remove" size={20} color={BrandColors.textPrimary} />
      </Pressable>
      <Text style={styles.stepValue}>{value}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Increase ${label}`}
        disabled={value >= max}
        onPress={() => onChange(value + 1)}
        style={[styles.stepButton, value >= max && styles.disabled]}>
        <MaterialIcons name="add" size={20} color={BrandColors.textPrimary} />
      </Pressable>
    </View>
  );
}

export const formStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  note: { fontSize: 13, color: BrandColors.textSecondary },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: BrandColors.textPrimary },
});

const styles = StyleSheet.create({
  field: { gap: 6 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  labelAction: { fontSize: 12, fontWeight: '700', color: BrandColors.accent },
  label: { fontSize: 13, fontWeight: '700', color: BrandColors.textPrimary },
  optional: { fontWeight: '400', color: BrandColors.textSecondary },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 12,
    fontSize: 15,
    color: BrandColors.textPrimary,
    backgroundColor: BrandColors.surface,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  multiline: { minHeight: 96, paddingTop: 12, textAlignVertical: 'top' },
  inputError: { borderColor: BrandColors.error },
  error: { fontSize: 13, color: BrandColors.error },
  hint: { fontSize: 12, color: BrandColors.textSecondary },
  card: {
    gap: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: BrandColors.surface,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: BrandColors.textPrimary },
  chip: {
    minHeight: 40,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: BrandColors.surface,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  chipSelected: { backgroundColor: BrandColors.accent, borderColor: BrandColors.accent },
  chipText: { fontSize: 13, fontWeight: '600', color: BrandColors.textPrimary },
  chipTextSelected: { color: BrandColors.surface, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.canvas,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  stepValue: { minWidth: 28, textAlign: 'center', fontSize: 18, fontWeight: '700', color: BrandColors.textPrimary },
});
