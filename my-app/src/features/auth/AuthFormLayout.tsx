import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppScrollView } from '@/components/app-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

type AuthFormLayoutProps = { title: string; children: ReactNode };

// Shared scrollable, keyboard-aware container for the signed-out screens.
export function AuthFormLayout({ title, children }: AuthFormLayoutProps) {
  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.root}>
        <AppScrollView contentContainerStyle={styles.content}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.appName}>
            Hostel &amp; PG Management
          </ThemedText>
          <ThemedText type="subtitle">{title}</ThemedText>
          {children}
        </AppScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  appName: { textTransform: 'uppercase' },
});
