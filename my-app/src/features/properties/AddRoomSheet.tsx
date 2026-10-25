import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/app-button';
import { BrandColors } from '@/constants/theme';
import { Chip, CountStepper, Field } from '@/features/properties/addProperty/formParts';
import { validateNewRoom, type NewRoomErrors } from '@/features/properties/propertyDetailsModel';
import { MAX_SHARING, ROOM_NUMBER_MAX, newKey, type RoomDraft } from '@/features/properties/propertySetup';
import type { PropertyRoom } from '@/features/properties/propertyTypes';

type Props = {
  rooms: readonly PropertyRoom[];
  /** Creates the room; resolves on success. A rejection message is shown in the sheet. */
  onSubmit: (draft: RoomDraft, includeFloor: boolean) => Promise<void>;
  onClose: () => void;
  busy: boolean;
  /** Failure from the last attempt, shown above the button. */
  submitError: string | null;
};

// Add Room form. Mount it only while open: each opening starts with fresh state and a new room key;
// the key is kept across retries so a retried save rewrites the same documents. Rent and floor are
// optional (the schema stores neither when empty); the beds are generated from the sharing count
// and start vacant.
export function AddRoomSheet({ rooms, onSubmit, onClose, busy, submitError }: Props) {
  const insets = useSafeAreaInsets();
  const [key] = useState(newKey);
  const [roomNumber, setRoomNumber] = useState('');
  const [sharing, setSharing] = useState(2);
  const [ac, setAc] = useState(false);
  const [rent, setRent] = useState('');
  const [floor, setFloor] = useState('');
  const [errors, setErrors] = useState<NewRoomErrors>({});

  const submit = () => {
    const found = validateNewRoom({ roomNumber, rent, floor }, rooms);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const hasFloor = floor.trim() !== '';
    void onSubmit(
      {
        key,
        roomNumber: roomNumber.trim(),
        numberAuto: false,
        floor: hasFloor ? Number(floor) : null,
        sharing,
        ac,
        rent: rent.trim(),
        bedLabels: [],
      },
      hasFloor,
    );
  };

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={busy ? undefined : onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.root}>
        <Pressable accessibilityLabel="Dismiss" disabled={busy} style={StyleSheet.absoluteFill} onPress={onClose} />
        <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.handle} />
          <Text accessibilityRole="header" style={styles.title}>
            Add room
          </Text>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
            <Field
              label="Room number"
              value={roomNumber}
              onChangeText={setRoomNumber}
              maxLength={ROOM_NUMBER_MAX}
              autoCapitalize="characters"
              error={errors.roomNumber}
            />
            <View style={styles.row}>
              <Text style={styles.label}>Beds (sharing)</Text>
              <CountStepper label="beds" value={sharing} min={1} max={MAX_SHARING} onChange={setSharing} />
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Air conditioning</Text>
              <View style={styles.chips}>
                <Chip label="Non-AC" selected={!ac} onPress={() => setAc(false)} />
                <Chip label="AC" selected={ac} onPress={() => setAc(true)} />
              </View>
            </View>
            <Field
              label="Rent per bed per month (₹)"
              optional
              value={rent}
              onChangeText={setRent}
              keyboardType="number-pad"
              maxLength={7}
              error={errors.rent}
            />
            <Field
              label="Floor (0 = ground)"
              optional
              value={floor}
              onChangeText={setFloor}
              keyboardType="number-pad"
              maxLength={2}
              error={errors.floor}
            />
            {errors.form ?? submitError ? <Text style={styles.error}>{errors.form ?? submitError}</Text> : null}
          </ScrollView>
          <View style={styles.actions}>
            <AppButton variant="secondary" label="Cancel" disabled={busy} onPress={onClose} style={styles.action} />
            <AppButton label="Add room" loading={busy} onPress={submit} style={styles.action} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(32, 42, 43, 0.45)' },
  sheet: {
    maxHeight: '90%',
    gap: 8,
    paddingTop: 8,
    paddingHorizontal: 16,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: BrandColors.surface,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 4, backgroundColor: BrandColors.border },
  title: { fontSize: 18, fontWeight: '800', color: BrandColors.textPrimary },
  form: { gap: 14, paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  chips: { flexDirection: 'row', gap: 8 },
  label: { flex: 1, fontSize: 14, fontWeight: '600', color: BrandColors.textPrimary },
  error: { fontSize: 13, color: BrandColors.error },
  actions: { flexDirection: 'row', gap: 8, paddingTop: 8 },
  action: { flex: 1 },
});
