import { useState } from 'react';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { BrandColors } from '@/constants/theme';

type LoginTextFieldProps<T extends FieldValues> = Omit<
  TextInputProps,
  'value' | 'onChangeText' | 'onBlur' | 'onFocus' | 'secureTextEntry'
> & {
  control: Control<T>;
  name: Path<T>;
  label: string;
  /** Renders a password field with a show/hide toggle. */
  isPassword?: boolean;
  error?: string;
};

// Rounded input used by the login screen. `label` is the accessibility label and placeholder.
export function LoginTextField<T extends FieldValues>({
  control,
  name,
  label,
  isPassword = false,
  error,
  ...inputProps
}: LoginTextFieldProps<T>) {
  const [isHidden, setIsHidden] = useState(true);
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.inputRow,
          isFocused && styles.inputRowFocused,
          error ? styles.inputRowError : null,
        ]}>
        <Controller
          control={control}
          name={name}
          render={({ field }) => (
            <TextInput
              {...inputProps}
              accessibilityLabel={label}
              placeholder={label}
              placeholderTextColor={BrandColors.textSecondary}
              value={typeof field.value === 'string' ? field.value : ''}
              onChangeText={field.onChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => {
                setIsFocused(false);
                field.onBlur();
              }}
              secureTextEntry={isPassword && isHidden}
              style={styles.input}
            />
          )}
        />
        {isPassword && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isHidden ? 'Show password' : 'Hide password'}
            onPress={() => setIsHidden((hidden) => !hidden)}
            hitSlop={12}>
            <Text style={styles.toggle}>{isHidden ? 'Show' : 'Hide'}</Text>
          </Pressable>
        )}
      </View>
      {error ? (
        <Text style={styles.errorText} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BrandColors.border,
    backgroundColor: BrandColors.surface,
    paddingHorizontal: 18,
  },
  inputRowFocused: { borderColor: BrandColors.accent },
  inputRowError: { borderColor: BrandColors.error },
  input: { flex: 1, minHeight: 54, fontSize: 16, color: BrandColors.textPrimary },
  toggle: { fontSize: 14, fontWeight: '600', color: BrandColors.accent },
  errorText: { fontSize: 13, color: BrandColors.error, paddingHorizontal: 4 },
});
