import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { APP_TAGLINE } from '@/constants/brand';
import { BrandColors } from '@/constants/theme';
import { HostellLogo } from '@/features/auth/HostellLogo';

// Full-screen loading state shown while the session or account profile is being read.
export function BrandedLoading() {
  return (
    <View style={styles.container} accessibilityRole="progressbar" accessibilityLabel="Loading">
      <HostellLogo />
      <Text style={styles.tagline}>{APP_TAGLINE}</Text>
      <ActivityIndicator color={BrandColors.accent} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: BrandColors.background,
  },
  tagline: { fontSize: 14, color: BrandColors.textSecondary },
  spinner: { marginTop: 16 },
});
