import { Alert, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { BrandColors } from '@/constants/theme';
import { STAY_CONFIRMATION_TEXT, STAY_CONFIRMATION_TITLE } from '@/features/tenantHome/stayConfirmation';

type Props = {
  onDecline: () => void;
  declining: boolean;
  failed: boolean;
  /** `card` for the Home screen; `plain` for the centred My Stay screen. */
  variant?: 'card' | 'plain';
};

// Shown while an owner has to confirm the tenant. Names nothing about the stay. "This isn't me" is for a
// phone number the owner entered by mistake: it is final, never links the account, and tells the owner to
// check the number.
export function StayConfirmationNotice({ onDecline, declining, failed, variant = 'card' }: Props) {
  const ask = () =>
    Alert.alert(
      'Is this not you?',
      'Your account will not be linked to any property, and your owner will be asked to check the phone number they entered. This can’t be undone.',
      [
        { text: 'Keep waiting', style: 'cancel' },
        { text: 'This isn’t me', style: 'destructive', onPress: onDecline },
      ],
    );
  return (
    <View style={[styles.box, variant === 'card' ? styles.card : styles.plain]}>
      <Text style={[styles.title, variant === 'plain' && styles.center]}>{STAY_CONFIRMATION_TITLE}</Text>
      <Text style={[styles.text, variant === 'plain' && styles.center]}>{STAY_CONFIRMATION_TEXT}</Text>
      {failed ? <Text style={styles.error} accessibilityRole="alert">Could not save that. Check your connection and try again.</Text> : null}
      <AppButton variant="secondary" size="sm" label="This isn’t me" loading={declining} onPress={ask} style={variant === 'plain' ? styles.plainButton : styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 8 },
  card: { padding: 16, borderRadius: 16, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  plain: { alignItems: 'center', padding: 24 },
  title: { fontSize: 16, fontWeight: '800', color: BrandColors.textPrimary },
  text: { fontSize: 13, lineHeight: 19, color: BrandColors.textSecondary },
  center: { textAlign: 'center' },
  error: { fontSize: 13, color: BrandColors.error },
  button: { alignSelf: 'flex-start' },
  plainButton: { alignSelf: 'center' },
});
