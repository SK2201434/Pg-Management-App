import { router, Stack, useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useKeyboardState, type KeyboardAwareScrollViewRef } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/app-button';
import { AppScrollView } from '@/components/app-scroll-view';
import { useConfirm } from '@/components/confirm-dialog';
import { BrandColors } from '@/constants/theme';
import { BedsStep } from '@/features/properties/addProperty/BedsStep';
import { DetailsStep } from '@/features/properties/addProperty/DetailsStep';
import { PhotosStep } from '@/features/properties/addProperty/PhotosStep';
import { ReviewStep } from '@/features/properties/addProperty/ReviewStep';
import { RoomsStep } from '@/features/properties/addProperty/RoomsStep';
import { PrimaryButton, SecondaryButton } from '@/features/properties/addProperty/formParts';
import { getPropertyErrorMessage, isDuplicateLocationError } from '@/features/properties/propertyService';
import type { SaveResult } from '@/features/properties/propertyCreation';
import {
  detailsValid,
  emptyForm,
  hasErrors,
  isDirty,
  validateForm,
  type PropertyForm,
} from '@/features/properties/propertySetup';
import { useAddProperty } from '@/features/properties/useAddProperty';

// Photos come after the rooms so each room can have its own photos.
const STEPS = ['Details', 'Rooms', 'Beds & rent', 'Photos', 'Review'] as const;
const LAST = STEPS.length - 1;

function successMessage(result: SaveResult, withRooms: boolean): string {
  const lines = [withRooms ? 'Your property, rooms and beds are saved.' : 'Your property is saved.'];
  if (result.photosFailed > 0) {
    lines.push(
      `${result.photosFailed} photo${result.photosFailed === 1 ? ' was' : 's were'} not uploaded. ${result.photoError ?? ''}`.trim(),
      'The property itself was saved without them.',
    );
  } else if (result.photosUploaded > 0) {
    lines.push(`${result.photosUploaded} photo${result.photosUploaded === 1 ? '' : 's'} uploaded.`);
  }
  return lines.join('\n\n');
}

// Add Property wizard: Details -> Rooms -> Beds & rent -> Photos -> Review. One form object holds
// every section, so moving between steps never loses input. Saving goes through
// PropertySaveSession (draft -> rooms/beds -> photos -> ready), which can be retried safely.
export function AddPropertyScreen() {
  const insets = useSafeAreaInsets();
  // The action bar steps aside while typing, so the keyboard never covers or pushes it over a field.
  const keyboardVisible = useKeyboardState((state) => state.isVisible);
  const navigation = useNavigation();
  const scroll = useRef<KeyboardAwareScrollViewRef>(null);
  const allowLeave = useRef(false);

  const [form, setForm] = useState<PropertyForm>(emptyForm);
  const [step, setStep] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [focusRoom, setFocusRoom] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();
  const { save, isPending, isError, error, progress, reset } = useAddProperty();

  const duplicateLocation = isError && isDuplicateLocationError(error);
  const locationError = duplicateLocation ? getPropertyErrorMessage(error) : undefined;
  const errors = validateForm(form);
  const update = (patch: Partial<PropertyForm>) => {
    if (isError) reset();
    setForm((current) => ({ ...current, ...patch }));
  };

  // The header shows the property name once there is one.
  useEffect(() => {
    router.setParams({ propertyName: form.name.trim() });
    // Only when the owner moves between steps, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Confirm before throwing away entered data; block leaving mid-save.
  const dirty = isDirty(form);
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (allowLeave.current || (!dirty && !isPending)) return;
        event.preventDefault();
        if (isPending) return;
        confirm({
          title: 'Discard this property?',
          message: 'What you entered will be lost.',
          confirmLabel: 'Discard',
          cancelLabel: 'Keep editing',
          destructive: true,
        }).then((discard) => {
          if (discard) navigation.dispatch(event.data.action);
        });
      }),
    [navigation, dirty, isPending, confirm],
  );

  const goTo = (next: number, focus: string | null = null) => {
    setStep(next);
    setFocusRoom(focus);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  const next = () => {
    if (step === 0 && !detailsValid(form)) {
      setShowErrors(true);
      return;
    }
    goTo(Math.min(step + 1, LAST));
  };

  const submit = () => {
    const found = validateForm(form);
    if (hasErrors(found)) {
      setShowErrors(true);
      goTo(Object.keys(found.rooms).length > 0 ? 1 : 0);
      return;
    }
    save(form, {
      // A duplicate location is fixed on Details, where the error shows above the coordinates.
      onError: (failure) => {
        if (isDuplicateLocationError(failure)) goTo(0);
      },
      onSuccess: (result) => {
        allowLeave.current = true;
        if (router.canGoBack()) router.back();
        else router.replace('/owner/properties');
        Alert.alert('Property saved', successMessage(result, form.rooms.length > 0));
      },
    });
  };

  const stepProps = { form, update, errors, showErrors, locationError };

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title: 'Add Property' }} />

      <View style={styles.progress} accessibilityRole="progressbar" accessibilityLabel={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}>
        {STEPS.map((label, i) => (
          <Pressable
            key={label}
            disabled={isPending || (i > 0 && !detailsValid(form))}
            onPress={() => goTo(i)}
            style={styles.progressItem}>
            <View style={[styles.bar, i <= step && styles.barDone]} />
            <Text numberOfLines={1} style={[styles.progressLabel, i === step && styles.progressActive]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <AppScrollView
        ref={scroll}
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        {step === 0 && <DetailsStep {...stepProps} />}
        {step === 1 && <RoomsStep {...stepProps} />}
        {step === 2 && (
          <BedsStep
            {...stepProps}
            focusRoomKey={focusRoom}
            // The step starts below the screen's 16 px content padding.
            onScrollTo={(y) => scroll.current?.scrollTo({ y: Math.max(0, y + 8), animated: true })}
          />
        )}
        {step === 3 && <PhotosStep {...stepProps} />}
        {step === 4 && <ReviewStep {...stepProps} onSetRent={(roomKey) => goTo(2, roomKey)} />}

        {isPending ? (
          <View style={styles.status} accessibilityLiveRegion="polite">
            <ActivityIndicator color={BrandColors.accent} />
            <Text style={styles.statusText}>{progress?.message ?? 'Saving…'}</Text>
            {progress?.fraction !== undefined ? (
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.round(progress.fraction * 100)}%` }]} />
              </View>
            ) : null}
          </View>
        ) : null}

        {isError && !duplicateLocation ? (
          <View style={styles.errorBox} accessibilityLiveRegion="polite">
            <Text style={styles.errorText}>{getPropertyErrorMessage(error)}</Text>
            <Text style={styles.errorNote}>
              Nothing you entered is lost. Retry continues the same save without creating duplicates; if it
              was interrupted part way, the property shows as “Setup incomplete” in your list until it
              finishes.
            </Text>
          </View>
        ) : null}
      </AppScrollView>

      {keyboardVisible ? null : (
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {step < LAST ? (
          <View style={styles.footerRow}>
            {step > 0 ? (
              <View style={styles.flex}>
                <SecondaryButton label="Back" onPress={() => goTo(step - 1)} />
              </View>
            ) : null}
            <View style={styles.flex}>
              <PrimaryButton label="Next" onPress={next} />
            </View>
          </View>
        ) : (
          <View style={styles.footerStack}>
            <AppButton
              variant="primary"
              label={isError ? 'Retry save' : 'Save Property'}
              loading={isPending}
              onPress={submit}
            />
            <View style={styles.footerRow}>
              <View style={styles.flex}>
                <SecondaryButton label="Back" disabled={isPending} onPress={() => goTo(step - 1)} />
              </View>
              <View style={styles.flex}>
                <SecondaryButton label="Cancel" disabled={isPending} onPress={() => router.back()} />
              </View>
            </View>
          </View>
        )}
      </View>
      )}
      {dialog}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: BrandColors.canvas },
  content: { padding: 16, gap: 16, paddingBottom: 24 },
  progress: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: BrandColors.canvas,
  },
  progressItem: { flex: 1, gap: 4, minHeight: 32 },
  bar: { height: 4, borderRadius: 2, backgroundColor: BrandColors.border },
  barDone: { backgroundColor: BrandColors.accent },
  progressLabel: { fontSize: 10, fontWeight: '600', color: BrandColors.textSecondary },
  progressActive: { color: BrandColors.textPrimary, fontWeight: '800' },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: BrandColors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BrandColors.border,
  },
  footerRow: { flexDirection: 'row', gap: 8 },
  footerStack: { gap: 8 },
  status: {
    alignItems: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 16,
    backgroundColor: BrandColors.surface,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  statusText: { fontSize: 14, fontWeight: '600', color: BrandColors.textPrimary },
  track: { alignSelf: 'stretch', height: 6, borderRadius: 3, backgroundColor: BrandColors.border, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: BrandColors.accent },
  errorBox: {
    gap: 6,
    padding: 16,
    borderRadius: 16,
    backgroundColor: BrandColors.surface,
    borderWidth: 1,
    borderColor: BrandColors.error,
  },
  errorText: { fontSize: 14, fontWeight: '700', color: BrandColors.error },
  errorNote: { fontSize: 12, color: BrandColors.textSecondary },
});
