import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppScrollView } from '@/components/app-scroll-view';
import { useConfirm } from '@/components/confirm-dialog';
import { BrandColors } from '@/constants/theme';
import { DetailsStep } from '@/features/properties/addProperty/DetailsStep';
import { PhotosStep } from '@/features/properties/addProperty/PhotosStep';
import { isEdited, type PropertyEditData } from '@/features/properties/propertyEdit';
import { parsePropertyId } from '@/features/properties/propertyDetailsModel';
import { getPropertyErrorMessage, isDuplicateLocationError, PropertyRequestError } from '@/features/properties/propertyService';
import { hasErrors, validateForm, type PropertyForm } from '@/features/properties/propertySetup';
import { usePropertyForEdit, useSavePropertyEdit } from '@/features/properties/usePropertyQueries';

// Edit Property: the details, amenities and photos of one of the signed-in owner's own properties.
// A property of another owner is refused when it loads, and the Security Rules refuse the write
// as well. Rooms and beds are managed from Rooms & Beds, not here.
export function EditPropertyScreen() {
  const params = useLocalSearchParams<{ propertyId?: string | string[] }>();
  const propertyId = parsePropertyId(params.propertyId);
  const loaded = usePropertyForEdit(propertyId);

  if (propertyId === null) return <Message icon="search-off" title="Property not found" body="This link does not point to a property." />;
  if (loaded.isPending) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Header />
        <ActivityIndicator color={BrandColors.accent} />
      </View>
    );
  }
  if (loaded.isError) {
    const kind = loaded.error instanceof PropertyRequestError ? loaded.error.kind : 'unknown';
    if (kind === 'permission-denied') return <Message icon="lock-outline" title="You can’t edit this property" body="You can only edit properties that belong to your account." />;
    if (kind === 'not-found') return <Message icon="search-off" title="Property not found" body="This property no longer exists." />;
    return <Message icon="error-outline" title="Couldn’t load the property" body={getPropertyErrorMessage(loaded.error)} onRetry={() => loaded.refetch()} />;
  }
  return <Editor propertyId={propertyId} original={loaded.data} />;
}

function Header({ name }: { name?: string }) {
  return <Stack.Screen options={{ title: 'Edit Property', headerTitle: name ?? '' }} />;
}

function Message({ icon, title, body, onRetry }: { icon: React.ComponentProps<typeof MaterialIcons>['name']; title: string; body: string; onRetry?: () => void }) {
  return (
    <View style={[styles.screen, styles.center]}>
      <Header />
      <MaterialIcons name={icon} size={32} color={BrandColors.textSecondary} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.muted}>{body}</Text>
      {onRetry ? <AppButton label="Retry" onPress={onRetry} style={styles.retry} /> : null}
    </View>
  );
}

function Editor({ propertyId, original }: { propertyId: string; original: PropertyEditData }) {
  // Set once the owner has chosen to leave (or the save finished), so leaving is no longer blocked.
  const [leaving, setLeaving] = useState(false);
  const { confirm, dialog } = useConfirm();
  const [form, setForm] = useState<PropertyForm>(original.form);
  const [showErrors, setShowErrors] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const save = useSavePropertyEdit(propertyId);

  const errors = validateForm({ ...form, rooms: [] });
  const update = (patch: Partial<PropertyForm>) => {
    if (save.isError) save.reset();
    setNotice(null);
    setForm((current) => ({ ...current, ...patch }));
  };

  const edited = isEdited(original.form, form);
  const disablePrevention = usePreventRemove(!leaving && (edited || save.isPending), ({ repeat }) => {
    if (save.isPending) return;
    confirm({ title: 'Discard your changes?', message: 'What you changed will be lost.', confirmLabel: 'Discard', cancelLabel: 'Keep editing', destructive: true }).then((discard) => {
      if (!discard) return;
      setLeaving(true);
      repeat();
    });
  });

  const submit = () => {
    if (save.isPending) return;
    setShowErrors(true);
    if (hasErrors({ ...errors, rooms: {} }) || !edited) return;
    save.mutate(
      { form, original },
      {
        onSuccess: (result) => {
          if (result.photosFailed > 0) {
            setNotice(`Saved, but ${result.photosFailed} ${result.photosFailed === 1 ? 'photo was' : 'photos were'} not uploaded. ${result.photoError ?? ''} Add them again and save.`.trim());
            // Keep editing: the photos that failed are still in the form to try again.
            return;
          }
          setLeaving(true);
          disablePrevention();
          router.back();
        },
      },
    );
  };

  return (
    <View style={styles.screen}>
      <Header name={original.form.name} />
      <AppScrollView contentContainerStyle={styles.content}>
        <DetailsStep form={form} update={update} errors={errors} showErrors={showErrors} locationError={save.isError && isDuplicateLocationError(save.error) ? getPropertyErrorMessage(save.error) : undefined} />
        <PhotosStep form={form} update={update} errors={errors} showErrors={showErrors} />
        {save.isError && !isDuplicateLocationError(save.error) ? <Text style={styles.error} accessibilityRole="alert">{getPropertyErrorMessage(save.error)}</Text> : null}
        {notice ? <Text style={styles.error} accessibilityRole="alert">{notice}</Text> : null}
      </AppScrollView>
      <View style={styles.footer}>
        {save.isPending ? (
          <Text style={styles.muted}>{save.progress?.message ?? 'Saving…'}</Text>
        ) : !edited ? (
          <Text style={styles.muted}>No changes yet.</Text>
        ) : null}
        <AppButton label="Save changes" variant="submit" loading={save.isPending} disabled={!edited} onPress={submit} />
      </View>
      {dialog}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BrandColors.canvas },
  center: { alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  content: { padding: 16, gap: 16, paddingBottom: 24 },
  footer: { gap: 8, padding: 16, backgroundColor: BrandColors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BrandColors.border },
  title: { fontSize: 17, fontWeight: '800', color: BrandColors.textPrimary },
  muted: { fontSize: 13, textAlign: 'center', color: BrandColors.textSecondary },
  error: { fontSize: 13, color: BrandColors.error },
  retry: { alignSelf: 'stretch', marginTop: 8 },
});
