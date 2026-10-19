import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { getAuthErrorMessage } from '@/features/auth/authErrorMessage';
import { logoutOwnerThunk } from '@/features/auth/ownerAuthSlice';
import { useAppDispatch } from '@/store/hooks';

// Signs out of Firebase. On success the auth observer updates Redux and OwnerAuthGate returns to
// the login screen; on failure the owner stays signed in and the error is shown here.
export function SignOutButton() {
  const dispatch = useAppDispatch();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPress = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    setError(null);
    try {
      await dispatch(logoutOwnerThunk()).unwrap();
    } catch (thunkError) {
      setError(getAuthErrorMessage(thunkError));
      setIsSigningOut(false);
    }
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isSigningOut, busy: isSigningOut }}
        disabled={isSigningOut}
        onPress={onPress}
        hitSlop={Spacing.two}>
        <ThemedText type="linkPrimary">{isSigningOut ? 'Signing out…' : 'Sign out'}</ThemedText>
      </Pressable>
      {error ? (
        <ThemedText type="small" style={styles.error} accessibilityRole="alert">
          {error}
        </ThemedText>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({ error: { color: '#D93025' } });
