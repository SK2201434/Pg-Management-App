import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { OptionSheet } from '@/components/option-sheet';
import { BrandColors } from '@/constants/theme';
import { Card, SecondaryButton, formStyles } from '@/features/properties/addProperty/formParts';
import type { StepProps } from '@/features/properties/addProperty/stepTypes';
import { pickPhotos, type PhotoSource } from '@/features/properties/photoUpload';
import { MAX_PHOTOS, MAX_ROOM_PHOTOS, type PhotoDraft } from '@/features/properties/propertySetup';

type Group = 'property' | 'rooms';

const GROUPS: Record<Group, { title: string; hint: string; limit: number }> = {
  property: { title: 'Property photos', hint: 'Building, entrance and common areas', limit: MAX_PHOTOS },
  rooms: { title: 'Room photos', hint: 'What the rooms look like', limit: MAX_ROOM_PHOTOS },
};

// Two photo sets, up to 4 each, kept apart: the property itself and its rooms. Each has one
// "Add photos" button, which offers the camera or the gallery.
export function PhotosStep({ form, update }: StepProps) {
  const [group, setGroup] = useState<Group>('property');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const photosOf = (g: Group): PhotoDraft[] => (g === 'property' ? form.photos : form.roomPhotos);
  const setPhotos = (g: Group, photos: PhotoDraft[]) =>
    update(g === 'property' ? { photos } : { roomPhotos: photos });

  const open = (g: Group) => {
    setNotice(null);
    setGroup(g);
    setSheetOpen(true);
  };

  const add = async (source: PhotoSource) => {
    const existing = photosOf(group);
    setBusy(true);
    try {
      const { added, rejected } = await pickPhotos(source, GROUPS[group].limit - existing.length);
      if (added.length > 0) setPhotos(group, [...existing, ...added]);
      if (rejected.length > 0) setNotice(rejected.join('\n'));
    } catch {
      setNotice('The camera or photo library could not be opened. Check the app’s access in Settings.');
    } finally {
      setBusy(false);
    }
  };

  const section = (g: Group) => {
    const { title, hint, limit } = GROUPS[g];
    const photos = photosOf(g);
    return (
      <Card title={title}>
        <Text style={formStyles.note}>
          {hint} ({photos.length}/{limit})
        </Text>
        {photos.length >= limit ? <Text style={formStyles.note}>Limit reached. Tap ✕ on a photo to remove it, then add another.</Text> : null}
        {photos.length > 0 ? (
          <View style={styles.grid}>
            {photos.map((photo, index) => (
              <View key={photo.uri} style={styles.thumbWrap}>
                <Image source={{ uri: photo.uri }} style={styles.thumb} accessibilityLabel={`${title} ${index + 1}`} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${title.toLowerCase()} ${index + 1}`}
                  hitSlop={10}
                  onPress={() => setPhotos(g, photos.filter((p) => p.uri !== photo.uri))}
                  style={styles.remove}>
                  <MaterialIcons name="close" size={16} color={BrandColors.surface} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
        <SecondaryButton
          icon="add-a-photo"
          label="Add photos"
          disabled={busy || photos.length >= limit}
          onPress={() => open(g)}
        />
      </Card>
    );
  };

  return (
    <View style={{ gap: 16 }}>
      <Text style={formStyles.sectionTitle}>Photos</Text>
      <Text style={formStyles.note}>
        Photos will be uploaded when you save. Up to {MAX_PHOTOS} property photos and {MAX_ROOM_PHOTOS} room photos, {MAX_PHOTOS + MAX_ROOM_PHOTOS} in total ({form.photos.length + form.roomPhotos.length}/{MAX_PHOTOS + MAX_ROOM_PHOTOS} added).
      </Text>

      {section('property')}
      {section('rooms')}

      {busy ? (
        <View style={styles.busy} accessibilityLiveRegion="polite">
          <ActivityIndicator color={BrandColors.accent} />
          <Text style={formStyles.note}>Preparing photos…</Text>
        </View>
      ) : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <OptionSheet
        visible={sheetOpen}
        title={`Add ${GROUPS[group].title.toLowerCase()}`}
        onClose={() => setSheetOpen(false)}
        options={[
          { label: 'Take a photo', icon: 'photo-camera', onPress: () => add('camera') },
          { label: 'Choose from gallery', icon: 'photo-library', onPress: () => add('gallery') },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumbWrap: { width: '23%', aspectRatio: 1 },
  thumb: { flex: 1, borderRadius: 12, backgroundColor: BrandColors.canvas },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.textPrimary,
  },
  busy: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notice: { fontSize: 13, color: BrandColors.error },
});
