import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandColors } from '@/constants/theme';

const WHATSAPP_GREEN = '#25D366';

type Props = {
  visible: boolean;
  /** `tel:` link, or null when the number cannot be called. */
  callUrl: string | null;
  /** `https://wa.me/...` link, or null when the number cannot be messaged. */
  whatsAppUrl: string | null;
  onOpen: (url: string) => void;
  onClose: () => void;
};

// How to reach the host: a phone call or WhatsApp, as two equal tiles, with a small close button at
// the top right. An option the number does not allow is left out.
export function ContactHostDialog({ visible, callUrl, whatsAppUrl, onOpen, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable accessibilityLabel="Dismiss" style={StyleSheet.absoluteFill} onPress={onClose} />
        <View accessibilityViewIsModal style={styles.dialog}>
          <View style={styles.header}>
            <View style={styles.flex}>
              <Text accessibilityRole="header" style={styles.title}>Contact host</Text>
              <Text style={styles.message}>How would you like to reach your host?</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} onPress={onClose} style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
              <MaterialIcons name="close" size={22} color={BrandColors.textSecondary} />
            </Pressable>
          </View>
          <View style={styles.options}>
            {callUrl ? (
              <Option label="Call" onPress={() => onOpen(callUrl)} icon={<MaterialIcons name="call" size={34} color={BrandColors.accent} />} />
            ) : null}
            {whatsAppUrl ? (
              <Option label="WhatsApp" onPress={() => onOpen(whatsAppUrl)} icon={<FontAwesome name="whatsapp" size={36} color={WHATSAPP_GREEN} />} />
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Option({ label, icon, onPress }: { label: string; icon: React.ReactNode; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
      {icon}
      <Text style={styles.optionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(32, 42, 43, 0.45)' },
  dialog: { width: '100%', maxWidth: 380, gap: 18, padding: 20, borderRadius: 14, backgroundColor: BrandColors.surface, elevation: 8 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  flex: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontSize: 18, fontWeight: '800', color: BrandColors.textPrimary },
  message: { fontSize: 14, lineHeight: 20, color: BrandColors.textSecondary },
  close: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  options: { flexDirection: 'row', gap: 12 },
  option: { flex: 1, alignItems: 'center', gap: 10, paddingVertical: 12, borderRadius: 18 },
  optionLabel: { fontSize: 14, fontWeight: '700', color: BrandColors.textPrimary },
  pressed: { opacity: 0.8 },
});
