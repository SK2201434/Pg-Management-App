import {
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewProps,
  type KeyboardAwareScrollViewRef,
} from 'react-native-keyboard-controller';
import type { Ref } from 'react';

type AppScrollViewProps = KeyboardAwareScrollViewProps & { ref?: Ref<KeyboardAwareScrollViewRef> };

// The app-wide scroll container for any screen that can show the keyboard. It scrolls the focused
// input (and its caret) above the keyboard, on Android and iOS, so typed text is never hidden.
// Use it instead of ScrollView / KeyboardAvoidingView for every form or searchable screen. The
// provider that makes this work lives in the root layout (KeyboardProvider).
export function AppScrollView({ ref, ...props }: AppScrollViewProps) {
  return (
    <KeyboardAwareScrollView
      ref={ref}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      bottomOffset={24}
      {...props}
    />
  );
}
