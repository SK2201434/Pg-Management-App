import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { BrandColors } from '@/constants/theme';
import { canRequestMoveOut, formatMoveOutDate, MOVE_OUT_LABEL, type MoveOutOption, type MoveOutRequest } from '@/features/moveOut/moveOutModel';

type Props = {
  visible: boolean;
  /** What the property's rules allow; empty when it allows none. */
  options: readonly MoveOutOption[];
  existing: MoveOutRequest | null;
  busy: boolean;
  error: string | null;
  onSubmit: (option: MoveOutOption) => void;
  onWithdraw: () => void;
  onClose: () => void;
};

// Move out: the choices the property allows (move out now, or after a notice period), each with the
// date it means. A request goes to the owner, who approves or declines it. While one is open the
// dialog shows its status instead, and lets the tenant withdraw it.
export function MoveOutDialog({ visible, options, existing, busy, error, onSubmit, onWithdraw, onClose }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const choice = options.find((o) => o.id === selected) ?? null;
  const open = existing !== null && !canRequestMoveOut(existing);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={busy ? undefined : onClose}>
      <View style={styles.root}>
        <Pressable accessibilityLabel="Dismiss" style={StyleSheet.absoluteFill} disabled={busy} onPress={onClose} />
        <View accessibilityViewIsModal style={styles.dialog}>
          <View style={styles.header}>
            <View style={styles.flex}>
              <Text accessibilityRole="header" style={styles.title}>Move out</Text>
              <Text style={styles.message}>
                {open ? 'Your request is with the owner.' : options.length > 0 ? 'Choose when you want to move out. The owner will review your request.' : 'This property has not offered any move-out option.'}
              </Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} disabled={busy} onPress={onClose} style={styles.close}>
              <MaterialIcons name="close" size={22} color={BrandColors.textSecondary} />
            </Pressable>
          </View>

          {open && existing ? (
            <View style={styles.status}>
              <Text style={styles.statusTitle}>{MOVE_OUT_LABEL[existing.status]}</Text>
              <Text style={styles.message}>Move-out date: {formatMoveOutDate(existing.moveOutMs)}</Text>
              {existing.status === 'pending' ? <AppButton variant="secondary" label="Withdraw request" loading={busy} onPress={onWithdraw} /> : null}
            </View>
          ) : (
            <>
              {existing?.status === 'rejected' ? <Text style={styles.error}>Your last move-out request was declined. You can send a new one.</Text> : null}
              <View style={styles.options}>
                {options.map((o) => {
                  const on = o.id === selected;
                  return (
                    <Pressable key={o.id} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setSelected(o.id)} style={[styles.option, on && styles.optionOn]}>
                      <MaterialIcons name={on ? 'radio-button-checked' : 'radio-button-unchecked'} size={22} color={on ? BrandColors.accent : BrandColors.textSecondary} />
                      <View style={styles.flex}>
                        <Text style={styles.optionTitle}>{o.label}</Text>
                        <Text style={styles.message}>{o.kind === 'instant' ? 'Today' : formatMoveOutDate(o.dateMs)}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
              {options.length > 0 ? <AppButton label="Request move-out" loading={busy} disabled={!choice} onPress={() => choice && onSubmit(choice)} /> : null}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(32, 42, 43, 0.45)' },
  dialog: { width: '100%', maxWidth: 380, gap: 14, padding: 20, borderRadius: 14, backgroundColor: BrandColors.surface, elevation: 8 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 18, fontWeight: '800', color: BrandColors.textPrimary },
  message: { fontSize: 13, lineHeight: 19, color: BrandColors.textSecondary },
  close: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  options: { gap: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: BrandColors.border },
  optionOn: { borderColor: BrandColors.accent, backgroundColor: '#F1F7F5' },
  optionTitle: { fontSize: 14, fontWeight: '700', color: BrandColors.textPrimary },
  status: { gap: 8 },
  statusTitle: { fontSize: 15, fontWeight: '800', color: BrandColors.accent },
  error: { fontSize: 13, color: BrandColors.error },
});
