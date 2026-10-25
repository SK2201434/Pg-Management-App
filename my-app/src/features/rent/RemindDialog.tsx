import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandColors } from '@/constants/theme';
import type { RentReminder } from '@/features/rent/reminderModel';
import { formatDate, formatInr } from '@/features/rent/rentModel';

type Props = {
  visible: boolean;
  tenantName: string;
  reminder: RentReminder | null;
  /** The in-app notification needs the tenant to have an account in the app. */
  canNotify: boolean;
  busy: boolean;
  error: string | null;
  callUrl: string | null;
  whatsAppUrl: string | null;
  onNotify: () => void;
  onOpen: (url: string) => void;
  onClose: () => void;
};

// Remind a tenant about rent: shows the message (the month and the amount payable) and three ways to
// send it: an in-app notification, a phone call, or a WhatsApp message with the text already typed.
export function RemindDialog({ visible, tenantName, reminder, canNotify, busy, error, callUrl, whatsAppUrl, onNotify, onOpen, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={busy ? undefined : onClose}>
      <View style={styles.root}>
        <Pressable accessibilityLabel="Dismiss" style={StyleSheet.absoluteFill} disabled={busy} onPress={onClose} />
        <View accessibilityViewIsModal style={styles.dialog}>
          <View style={styles.header}>
            <View style={styles.flex}>
              <Text accessibilityRole="header" style={styles.title}>Remind {tenantName}</Text>
              <Text style={styles.muted}>Send a rent reminder in the way that suits you.</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} disabled={busy} onPress={onClose} style={styles.close}>
              <MaterialIcons name="close" size={22} color={BrandColors.textSecondary} />
            </Pressable>
          </View>

          {reminder ? (
            <>
              <View style={styles.summary}>
                <Text style={styles.month}>{reminder.monthLabel}</Text>
                <Text style={styles.amount}>{formatInr(reminder.amountInr)}</Text>
                <Text style={styles.muted}>
                  {reminder.status === 'overdue' ? 'Overdue' : reminder.status === 'due-today' ? 'Due today' : `Due ${formatDate(reminder.dueMs)}`}
                  {reminder.unpaidMonths > 1 ? ` · ${formatInr(reminder.totalInr)} outstanding in total` : ''}
                </Text>
              </View>
              <Text style={styles.message}>{reminder.message}</Text>
              {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
              <View style={styles.options}>
                <Option
                  label="Notify"
                  disabled={!canNotify || busy}
                  busy={busy}
                  onPress={onNotify}
                  icon={<MaterialIcons name="notifications-active" size={30} color={BrandColors.accent} />}
                />
                <Option label="Call" disabled={!callUrl || busy} onPress={() => callUrl && onOpen(callUrl)} icon={<MaterialIcons name="call" size={30} color={BrandColors.accent} />} />
                <Option label="WhatsApp" disabled={!whatsAppUrl || busy} onPress={() => whatsAppUrl && onOpen(whatsAppUrl)} icon={<FontAwesome name="whatsapp" size={32} color="#25D366" />} />
              </View>
              {!canNotify ? <Text style={styles.muted}>This tenant has no app account, so they can’t receive an in-app notification.</Text> : null}
              {!callUrl && !whatsAppUrl ? <Text style={styles.muted}>No phone number is stored for this tenant.</Text> : null}
            </>
          ) : (
            <Text style={styles.muted}>Nothing is due for this tenant, so there is nothing to remind.</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

function Option({ label, icon, disabled, busy, onPress }: { label: string; icon: React.ReactNode; disabled: boolean; busy?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy: !!busy }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.option, disabled && styles.dim, pressed && styles.pressed]}>
      {icon}
      <Text style={styles.optionLabel}>{busy ? 'Sending…' : label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(32, 42, 43, 0.45)' },
  dialog: { width: '100%', maxWidth: 400, gap: 14, padding: 20, borderRadius: 14, backgroundColor: BrandColors.surface, elevation: 8 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 18, fontWeight: '800', color: BrandColors.textPrimary },
  muted: { fontSize: 13, lineHeight: 19, color: BrandColors.textSecondary },
  close: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  summary: { alignItems: 'center', gap: 2, paddingVertical: 12, borderRadius: 12, backgroundColor: '#F1F7F5' },
  month: { fontSize: 13, fontWeight: '700', color: BrandColors.textSecondary },
  amount: { fontSize: 28, fontWeight: '800', color: BrandColors.textPrimary },
  message: { fontSize: 13, lineHeight: 20, color: BrandColors.textPrimary },
  options: { flexDirection: 'row', gap: 8 },
  option: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 12, borderRadius: 12 },
  optionLabel: { fontSize: 13, fontWeight: '700', color: BrandColors.textPrimary },
  error: { fontSize: 13, color: BrandColors.error },
  dim: { opacity: 0.4 },
  pressed: { opacity: 0.8 },
});
