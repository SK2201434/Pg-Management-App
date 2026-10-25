import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { BrandColors } from '@/constants/theme';
import { formatInr } from '@/features/rent/rentModel';
import { canApply, canPropose, stayLabel, STAY_CHANGE_LABEL, type BedChoice, type StayChange } from '@/features/stayChange/stayChangeModel';

type Props = {
  visible: boolean;
  tenantName: string;
  current: { roomNumber: string; bedLabel: string | null };
  choices: readonly BedChoice[];
  existing: StayChange | null;
  busy: boolean;
  error: string | null;
  onPropose: (choice: BedChoice) => void;
  onCancel: () => void;
  onApply: () => void;
  onClose: () => void;
};

// Change a tenant's room or bed. The owner only PROPOSES a free bed; the tenant gets a notification
// and must accept; only then can the owner apply it. While a proposal is open the sheet shows where
// it stands instead of the list.
export function ChangeStaySheet({ visible, tenantName, current, choices, existing, busy, error, onPropose, onCancel, onApply, onClose }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const choice = choices.find((c) => c.bedId === selected) ?? null;
  const open = existing !== null && !canPropose(existing);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={busy ? undefined : onClose}>
      <View style={styles.root}>
        <Pressable accessibilityLabel="Dismiss" style={StyleSheet.absoluteFill} disabled={busy} onPress={onClose} />
        <View accessibilityViewIsModal style={styles.dialog}>
          <View style={styles.header}>
            <View style={styles.flex}>
              <Text accessibilityRole="header" style={styles.title}>Change stay</Text>
              <Text style={styles.muted}>Now in {stayLabel(current.roomNumber, current.bedLabel)}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} disabled={busy} onPress={onClose} style={styles.close}>
              <MaterialIcons name="close" size={22} color={BrandColors.textSecondary} />
            </Pressable>
          </View>

          {open && existing ? (
            <View style={styles.gap}>
              <View style={styles.status}>
                <Text style={styles.statusTitle}>{STAY_CHANGE_LABEL[existing.status]}</Text>
                <Text style={styles.body}>
                  Move {tenantName} to {stayLabel(existing.toRoomNumber, existing.toBedLabel)}
                  {existing.toRentInr !== null ? ` · ${formatInr(existing.toRentInr)} / month` : ''}
                </Text>
                <Text style={styles.muted}>
                  {canApply(existing) ? `${tenantName} accepted. Apply it to update their room and bed.` : `${tenantName} has been notified and must accept before anything changes.`}
                </Text>
              </View>
              {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
              {canApply(existing) ? <AppButton label="Apply change" loading={busy} onPress={onApply} /> : null}
              <AppButton variant="secondary" label={canApply(existing) ? 'Discard' : 'Cancel proposal'} disabled={busy} onPress={onCancel} />
            </View>
          ) : (
            <View style={styles.gap}>
              {existing?.status === 'declined' ? <Text style={styles.error}>{tenantName} declined your last proposal. You can propose a different bed.</Text> : null}
              <Text style={styles.muted}>
                {choices.length > 0 ? `Pick a free bed. ${tenantName} will be notified and their room changes only after they accept.` : 'No other bed is free right now.'}
              </Text>
              <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
                {choices.map((c) => {
                  const on = c.bedId === selected;
                  return (
                    <Pressable key={c.bedId} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setSelected(c.bedId)} style={[styles.option, on && styles.optionOn]}>
                      <MaterialIcons name={on ? 'radio-button-checked' : 'radio-button-unchecked'} size={22} color={on ? BrandColors.accent : BrandColors.textSecondary} />
                      <View style={styles.flex}>
                        <Text style={styles.optionTitle}>{stayLabel(c.roomNumber, c.bedLabel)}</Text>
                        <Text style={styles.muted}>
                          {c.sharing === 1 ? 'Single' : `${c.sharing}-sharing`} · {c.ac ? 'AC' : 'Non-AC'} · {c.rentInr !== null ? `${formatInr(c.rentInr)} / month` : 'Rent not set'}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
              {choices.length > 0 ? <AppButton label="Send to tenant" loading={busy} disabled={!choice} onPress={() => choice && onPropose(choice)} /> : null}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(32, 42, 43, 0.45)' },
  dialog: { width: '100%', maxWidth: 400, maxHeight: '85%', gap: 14, padding: 20, borderRadius: 14, backgroundColor: BrandColors.surface, elevation: 8 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  gap: { gap: 12, flexShrink: 1 },
  title: { fontSize: 18, fontWeight: '800', color: BrandColors.textPrimary },
  muted: { fontSize: 13, lineHeight: 19, color: BrandColors.textSecondary },
  body: { fontSize: 14, lineHeight: 20, color: BrandColors.textPrimary },
  close: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  list: { flexGrow: 0, maxHeight: 280 },
  listContent: { gap: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: BrandColors.border },
  optionOn: { borderColor: BrandColors.accent, backgroundColor: '#F1F7F5' },
  optionTitle: { fontSize: 14, fontWeight: '700', color: BrandColors.textPrimary },
  status: { gap: 4, padding: 12, borderRadius: 12, backgroundColor: '#F1F7F5' },
  statusTitle: { fontSize: 15, fontWeight: '800', color: BrandColors.accent },
  error: { fontSize: 13, color: BrandColors.error },
});
