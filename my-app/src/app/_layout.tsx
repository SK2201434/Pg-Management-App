import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { Provider } from 'react-redux';

import AppTabs from '@/components/app-tabs';
import { OwnerAuthGate } from '@/features/auth/OwnerAuthGate';
import { InviteLinkCapture } from '@/features/referral/InviteLinkCapture';
import { queryClient } from '@/lib/queryClient';
import { store } from '@/store/store';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <InviteLinkCapture />
          <OwnerAuthGate>
            <AppTabs />
          </OwnerAuthGate>
        </ThemeProvider>
      </QueryClientProvider>
    </Provider>
    </KeyboardProvider>
  );
}
