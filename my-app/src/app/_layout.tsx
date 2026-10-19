import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { Provider } from 'react-redux';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { OwnerAuthGate } from '@/features/auth/OwnerAuthGate';
import { queryClient } from '@/lib/queryClient';
import { store } from '@/store/store';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AnimatedSplashOverlay />
          <OwnerAuthGate>
            <AppTabs />
          </OwnerAuthGate>
        </ThemeProvider>
      </QueryClientProvider>
    </Provider>
  );
}
