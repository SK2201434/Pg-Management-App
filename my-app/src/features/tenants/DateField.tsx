import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/app-button';
import { BrandColors } from '@/constants/theme';
import { formatDate } from '@/features/rent/rentModel';

type Props = { label: string; valueMs: number; onChange: (ms: number) => void; error?: string };

// A date field backed by the platform's native picker (a dialog on Android, an inline calendar in a
// sheet on iOS). The value is a timestamp; the screen decides what range is acceptable.
export function DateField({ label, valueMs, onChange, error }: Props) {
  const insets = useSafeAreaInsets();
  const [iosOpen, setIosOpen] = useState(false);
  const [draft, setDraft] = useState(valueMs);

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: new Date(valueMs),
        mode: 'date',
        onChange: (event: DateTimePickerEvent, date?: Date) => {
          if (event.type === 'set' && date) onChange(date.getTime());
        },
      });
    } else {
      setDraft(valueMs);
      setIosOpen(true);
    }
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${formatDate(valueMs)}. Change`} onPress={open} style={[styles.input, !!error && styles.inputError]}>
        <Text style={styles.value}>{formatDate(valueMs)}</Text>
        <MaterialIcons name="calendar-today" size={18} color={BrandColors.textSecondary} />
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {iosOpen ? (
        <Modal transparent animationType="slide" onRequestClose={() => setIosOpen(false)}>
          <View style={styles.backdrop}>
            <Pressable accessibilityLabel="Dismiss" style={StyleSheet.absoluteFill} onPress={() => setIosOpen(false)} />
            <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
              <DateTimePicker value={new Date(draft)} mode="date" display="inline" accentColor={BrandColors.accent} onChange={(_e, date) => date && setDraft(date.getTime())} />
              <AppButton
                label="Done"
                onPress={() => {
                  onChange(draft);
                  setIosOpen(false);
                }}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: BrandColors.textPrimary },
  input: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: BrandColors.border, backgroundColor: BrandColors.surface },
  inputError: { borderColor: BrandColors.error },
  value: { fontSize: 15, color: BrandColors.textPrimary },
  error: { fontSize: 12, color: BrandColors.error },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(32, 42, 43, 0.45)' },
  sheet: { gap: 8, padding: 16, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: BrandColors.surface },
});
