import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useConfirm } from '@/components/confirm-dialog';
import { BrandColors } from '@/constants/theme';
import {
  Card,
  Chip,
  CountStepper,
  Field,
  SecondaryButton,
  formStyles,
} from '@/features/properties/addProperty/formParts';
import type { StepProps } from '@/features/properties/addProperty/stepTypes';
import {
  MAX_FLOORS,
  MAX_ROOMS,
  ROOM_NUMBER_MAX,
  floorLabel,
  newRoom,
  renumberAutoRooms,
  type RoomDraft,
} from '@/features/properties/propertySetup';

// Building structure: optional floors and the rooms on them. Beds and rent come in the next step.
export function RoomsStep({ form, update, errors }: StepProps) {
  const { rooms, useFloors, floorCount } = form;
  const { confirm, dialog } = useConfirm();
  const floors = useFloors ? Array.from({ length: floorCount }, (_, i) => i) : [null];
  const atLimit = rooms.length >= MAX_ROOMS;

  const patchRoom = (key: string, patch: Partial<RoomDraft>) =>
    update({ rooms: rooms.map((r) => (r.key === key ? { ...r, ...patch } : r)) });

  const setFloors = (enabled: boolean) => {
    update(
      enabled
        ? { useFloors: true, rooms: renumberAutoRooms(rooms.map((r) => ({ ...r, floor: r.floor ?? 0 }))) }
        : { useFloors: false, rooms: renumberAutoRooms(rooms.map((r) => ({ ...r, floor: null }))) },
    );
  };

  const setFloorCount = async (count: number) => {
    const dropped = rooms.filter((r) => r.floor !== null && r.floor >= count);
    const apply = () =>
      update({ floorCount: count, rooms: rooms.filter((r) => r.floor === null || r.floor < count) });
    if (dropped.length === 0) return apply();
    const ok = await confirm({
      title: 'Remove rooms?',
      message: `${dropped.length} room${dropped.length === 1 ? '' : 's'} on ${floorLabel(count)} and above will be removed.`,
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (ok) apply();
  };

  return (
    <View style={{ gap: 16 }}>
      <Text style={formStyles.sectionTitle}>Floors and rooms</Text>
      <Text style={formStyles.note}>Optional. You can save the property now and add rooms later.</Text>

      <Card>
        <View style={formStyles.spread}>
          <Text style={styles.toggleLabel}>Organise rooms by floor</Text>
          <View style={formStyles.row}>
            <Chip label="No" selected={!useFloors} onPress={() => setFloors(false)} />
            <Chip label="Yes" selected={useFloors} onPress={() => setFloors(true)} />
          </View>
        </View>
        {useFloors ? (
          <View style={formStyles.spread}>
            <Text style={styles.toggleLabel}>Number of floors (incl. ground)</Text>
            <CountStepper label="floors" value={floorCount} min={1} max={MAX_FLOORS} onChange={setFloorCount} />
          </View>
        ) : null}
      </Card>

      {floors.map((floor) => {
        const onFloor = rooms.filter((r) => r.floor === floor);
        const title =
          floor === null
            ? 'Rooms'
            : `${floorLabel(floor)} · ${onFloor.length} room${onFloor.length === 1 ? '' : 's'}`;
        return (
          <Card key={floor ?? 'all'} title={title}>
            {onFloor.map((room) => (
              <View key={room.key} style={styles.roomRow}>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Room number"
                    value={room.roomNumber}
                    onChangeText={(roomNumber) => patchRoom(room.key, { roomNumber, numberAuto: false })}
                    maxLength={ROOM_NUMBER_MAX}
                    autoCapitalize="characters"
                    error={errors.rooms[room.key]}
                  />
                </View>
                <View style={styles.roomActions}>
                  <Chip label="AC" selected={room.ac} onPress={() => patchRoom(room.key, { ac: !room.ac })} />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove room ${room.roomNumber}`}
                    onPress={() => update({ rooms: rooms.filter((r) => r.key !== room.key) })}
                    style={styles.iconButton}>
                    <MaterialIcons name="delete-outline" size={20} color={BrandColors.error} />
                  </Pressable>
                </View>
              </View>
            ))}
            <SecondaryButton
              icon="add"
              label="Add room"
              disabled={atLimit}
              onPress={() => update({ rooms: [...rooms, newRoom(rooms, floor)] })}
            />
          </Card>
        );
      })}
      {atLimit ? <Text style={formStyles.note}>Up to {MAX_ROOMS} rooms can be added here.</Text> : null}
      {dialog}
    </View>
  );
}

const styles = StyleSheet.create({
  toggleLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: BrandColors.textPrimary },
  roomRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  roomActions: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 24 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.canvas,
  },
});
