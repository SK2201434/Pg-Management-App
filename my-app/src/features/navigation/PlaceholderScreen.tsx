import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { SignOutButton } from '@/features/auth/SignOutButton';

// Empty destination for a tab whose feature screen is not built yet. Replace it per route.
// `showSignOut` keeps sign-out reachable (it previously lived on the starter home screen).
export function PlaceholderScreen({ title, showSignOut }: { title: string; showSignOut?: boolean }) {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="subtitle">{title}</ThemedText>
      <ThemedText themeColor="textSecondary">Coming soon</ThemedText>
      {showSignOut && <SignOutButton />}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
});
