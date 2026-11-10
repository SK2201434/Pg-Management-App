import {
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewProps,
  type KeyboardAwareScrollViewRef,
} from 'react-native-keyboard-controller';
import { useCallback, useRef, type Ref } from 'react';

import { ErrorScrollProvider } from '@/components/form-error-scroll';

type AppScrollViewProps = KeyboardAwareScrollViewProps & { ref?: Ref<KeyboardAwareScrollViewRef> };

// The app-wide scroll container for any screen that can show the keyboard. It scrolls the focused
// input (and its caret) above the keyboard, on Android and iOS, so typed text is never hidden.
// Use it instead of ScrollView / KeyboardAvoidingView for every form or searchable screen. The
// provider that makes this work lives in the root layout (KeyboardProvider).
//
// It also scrolls a form field that starts showing a validation error into view (see
// `form-error-scroll`), so a failed submit takes the user to the problem instead of leaving the
// screen on the Submit button.
export function AppScrollView({ ref, ...props }: AppScrollViewProps) {
  const inner = useRef<KeyboardAwareScrollViewRef | null>(null);
  const setRef = useCallback(
    (node: KeyboardAwareScrollViewRef | null) => {
      inner.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as { current: KeyboardAwareScrollViewRef | null }).current = node;
    },
    [ref],
  );
  const getScroll = useCallback(() => inner.current, []);
  return (
    <ErrorScrollProvider getScroll={getScroll}>
      <KeyboardAwareScrollView
        ref={setRef}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        bottomOffset={24}
        {...props}
      />
    </ErrorScrollProvider>
  );
}
