import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandColors } from '@/constants/theme';
import { Card, formStyles } from '@/features/properties/addProperty/formParts';
import type { StepProps } from '@/features/properties/addProperty/stepTypes';
import { amenityLabel } from '@/features/properties/propertySetup';
import {
  bedLabelsFor,
  coverPhoto,
  floorLabel,
  formatInr,
  formatRentRange,
  parseRent,
  sharingLabel,
  summarize,
  type PropertyForm,
  type RoomDraft,
} from '@/features/properties/propertySetup';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function RoomLine({ room, onSetRent }: { room: RoomDraft; onSetRent?: (roomKey: string) => void }) {
  const rent = parseRent(room.rent);
  const beds = bedLabelsFor(room);
  return (
    <View style={styles.room}>
      <View style={styles.roomHead}>
        <Text style={styles.roomName}>Room {room.roomNumber.trim()}</Text>
        {rent !== null ? (
          <Text style={styles.roomRent}>{`${formatInr(rent)} / bed`}</Text>
        ) : onSetRent ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Rent not set for room ${room.roomNumber.trim()}. Tap to set it.`}
            hitSlop={8}
            onPress={() => onSetRent(room.key)}>
            <Text style={styles.rentMissing}>Rent not set {'\u203a'}</Text>
          </Pressable>
        ) : (
          <Text style={styles.rentMissing}>Rent not set</Text>
        )}
      </View>
      <Text style={styles.roomMeta}>
        {sharingLabel(room.sharing)} · {room.ac ? 'AC' : 'Non-AC'} · {beds.length} bed
        {beds.length === 1 ? '' : 's'}
      </Text>
      <View style={styles.bedRow}>
        {beds.map((label, i) => (
          <View key={i} style={styles.bedChip}>
            <Text style={styles.bedText}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// Every room exactly as it will be saved: number, sharing, AC, rent per bed and each bed's name,
// grouped by floor when floors are used. All beds are created available.
function RoomDetails({ form, onSetRent }: { form: PropertyForm; onSetRent?: (roomKey: string) => void }) {
  const groups: { title: string | null; rooms: RoomDraft[] }[] = form.useFloors
    ? Array.from({ length: form.floorCount }, (_, floor) => ({
        title: floorLabel(floor),
        rooms: form.rooms.filter((r) => r.floor === floor),
      }))
    : [{ title: null, rooms: form.rooms }];
  return (
    <View style={styles.details}>
      {groups.map((group) => (
        <View key={group.title ?? 'all'} style={styles.group}>
          {group.title ? (
            <Text style={styles.floorTitle}>
              {group.title} · {group.rooms.length} room{group.rooms.length === 1 ? '' : 's'}
            </Text>
          ) : null}
          {group.rooms.length === 0 ? (
            <Text style={formStyles.note}>No rooms on this floor.</Text>
          ) : (
            group.rooms.map((room) => <RoomLine key={room.key} room={room} onSetRent={onSetRent} />)
          )}
        </View>
      ))}
    </View>
  );
}

type ReviewStepProps = StepProps & {
  /** Takes the owner to the Beds & rent step, at this room, to set its rent. */
  onSetRent?: (roomKey: string) => void;
};

export function ReviewStep({ form, update, onSetRent }: ReviewStepProps) {
  const s = summarize(form);
  const cover = coverPhoto(form);
  const place = [form.location.trim(), form.city.trim(), form.state.trim(), form.postalCode.trim()].filter(Boolean).join(', ');
  const amenities = form.amenities.flatMap((k) => amenityLabel(k) ?? []);
  const contact = [form.contactName.trim(), form.contactPhone.trim()].filter(Boolean).join(' · ');
  return (
    <View style={{ gap: 16 }}>
      <Text style={formStyles.sectionTitle}>Review</Text>
      <Card title="Property">
        <Row label="Name" value={form.name.trim() || '—'} />
        <Row label="Address" value={place || '—'} />
        {contact ? <Row label="Contact" value={contact} /> : null}
        <Row label="Amenities" value={amenities.length > 0 ? amenities.join(', ') : 'None selected'} />
        <Row label="Property photos" value={s.photos === 0 ? 'None selected' : `${s.photos} selected`} />
        {form.photos.length > 0 ? (
          <View style={styles.coverBlock}>
            <Text style={styles.coverTitle}>Choose the display image</Text>
            <Text style={formStyles.note}>
              {form.photos.length > 1
                ? 'Tap a photo to use it as the property’s main picture.'
                : 'This photo will be the property’s main picture.'}
            </Text>
            <View style={styles.grid}>
              {form.photos.map((photo, index) => {
                const selected = photo === cover;
                return (
                  <Pressable
                    key={photo.uri}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Property photo ${index + 1}${selected ? ', display image' : ''}`}
                    onPress={() => update({ coverUri: photo.uri })}
                    style={[styles.thumbWrap, selected && styles.thumbSelected]}>
                    <Image source={{ uri: photo.uri }} style={styles.thumb} />
                    {selected ? (
                      <View style={styles.check}>
                        <MaterialIcons name="check" size={14} color={BrandColors.surface} />
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </Card>
      <Card title="Rooms and beds">
        <Row label="Rooms" value={s.rooms === 0 ? 'Not configured yet' : String(s.rooms)} />
        <Row label="Beds" value={s.rooms === 0 ? '—' : String(s.beds)} />
        <Row label="Rent per bed" value={s.rooms === 0 ? '—' : formatRentRange(s.rent)} />
        {s.rooms > 0 ? <RoomDetails form={form} onSetRent={onSetRent} /> : null}
        <Row label="Room photos" value={s.roomPhotos === 0 ? 'None selected' : `${s.roomPhotos} selected`} />
        {form.roomPhotos.length > 0 ? (
          <View style={styles.grid}>
            {form.roomPhotos.map((photo, index) => (
              // Same tile as the property photos above: a sized wrapper with a filling image.
              <View key={photo.uri} style={styles.thumbWrap}>
                <Image
                  source={{ uri: photo.uri }}
                  style={styles.thumb}
                  resizeMode="cover"
                  accessibilityLabel={`Room photo ${index + 1}`}
                />
              </View>
            ))}
          </View>
        ) : null}
        {s.rooms > 0 && s.roomsWithoutRent > 0 ? (
          <Text style={formStyles.note}>
            {s.roomsWithoutRent} room{s.roomsWithoutRent === 1 ? '' : 's'} without a rent set.
          </Text>
        ) : null}
        <Text style={formStyles.note}>All beds are created available. Occupancy is tracked from tenant stays.</Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  details: { gap: 12, marginVertical: 4 },
  group: { gap: 8 },
  floorTitle: { fontSize: 13, fontWeight: '800', color: BrandColors.textPrimary },
  room: {
    gap: 6,
    padding: 12,
    borderRadius: 12,
    backgroundColor: BrandColors.canvas,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  roomHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  roomName: { fontSize: 14, fontWeight: '700', color: BrandColors.textPrimary },
  roomRent: { fontSize: 13, fontWeight: '700', color: BrandColors.accent },
  rentMissing: { fontSize: 13, fontWeight: '700', color: BrandColors.error },
  roomMeta: { fontSize: 12, color: BrandColors.textSecondary },
  bedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  bedChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: BrandColors.surface,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  bedText: { fontSize: 12, color: BrandColors.textPrimary },
  coverBlock: { gap: 8, marginTop: 4 },
  coverTitle: { fontSize: 14, fontWeight: '700', color: BrandColors.textPrimary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumbWrap: { width: '23%', aspectRatio: 1, borderRadius: 14, borderWidth: 2, borderColor: 'transparent', padding: 2 },
  thumbSelected: { borderColor: BrandColors.accent },
  thumb: { flex: 1, borderRadius: 10, backgroundColor: BrandColors.canvas },
  check: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.accent,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  label: { fontSize: 13, color: BrandColors.textSecondary },
  value: { flex: 1, textAlign: 'right', fontSize: 14, fontWeight: '600', color: BrandColors.textPrimary },
});
