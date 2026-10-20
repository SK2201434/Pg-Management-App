import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useConfirm } from '@/components/confirm-dialog';

import { BrandColors } from '@/constants/theme';
import { Card, Chip, CountStepper, Field, formStyles } from '@/features/properties/addProperty/formParts';
import type { StepProps } from '@/features/properties/addProperty/stepTypes';
import {
  BED_LABEL_MAX,
  MAX_RENT_INR,
  MAX_SHARING,
  bedLabelsFor,
  defaultBedLabel,
  floorLabel,
  labelsLostBy,
  sharingLabel,
  type RoomDraft,
} from '@/features/properties/propertySetup';

const PRESETS = [1, 2, 3] as const;

// Per room: sharing type (which sets the number of beds), rent per bed, optional bed names.
// Rent is only what the owner types: nothing is derived from sharing or AC.
type BedsStepProps = StepProps & {
  /** Room to bring into view (e.g. when sent here from Review to set its rent). */
  focusRoomKey?: string | null;
  /** Asks the screen to scroll so a point `y` (relative to this step) is visible. */
  onScrollTo?: (y: number) => void;
};

export function BedsStep({ form, update, errors, focusRoomKey, onScrollTo }: BedsStepProps) {
  const [open, setOpen] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();
  const patch = (key: string, p: Partial<RoomDraft>) =>
    update({ rooms: form.rooms.map((r) => (r.key === key ? { ...r, ...p } : r)) });

  // Reducing beds never drops named beds without asking; the names are kept otherwise.
  const setSharing = async (room: RoomDraft, sharing: number) => {
    const lost = labelsLostBy(room, sharing);
    if (sharing >= room.sharing || lost.length === 0) return patch(room.key, { sharing });
    const ok = await confirm({
      title: 'Remove named beds?',
      message: `Room ${room.roomNumber} will lose: ${lost.join(', ')}.`,
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (ok) patch(room.key, { sharing, bedLabels: room.bedLabels.slice(0, sharing) });
  };

  if (form.rooms.length === 0) {
    return (
      <View style={{ gap: 16 }}>
        <Text style={formStyles.sectionTitle}>Beds and pricing</Text>
        <Card>
          <Text style={formStyles.note}>
            No rooms yet. Add rooms in the previous step, or skip this and set up rooms later.
          </Text>
        </Card>
      </View>
    );
  }

  return (
    <View style={{ gap: 16 }}>
      <Text style={formStyles.sectionTitle}>Beds and pricing</Text>
      <Text style={formStyles.note}>
        Sharing sets the number of beds. Rent is per bed per month, in rupees. Leave it empty if it is not
        decided; it will show as not configured.
      </Text>
      {form.rooms.map((room) => {
        const labels = bedLabelsFor(room);
        const expanded = open === room.key;
        const floorPart = form.useFloors && room.floor !== null ? ` · ${floorLabel(room.floor)}` : '';
        return (
          <View
            key={room.key}
            onLayout={(e) => {
              if (room.key === focusRoomKey) onScrollTo?.(e.nativeEvent.layout.y);
            }}>
          <Card title={`Room ${room.roomNumber || '—'}${floorPart}${room.ac ? ' · AC' : ''}`}>
            <View style={formStyles.wrap}>
              {PRESETS.map((n) => (
                <Chip key={n} label={sharingLabel(n)} selected={room.sharing === n} onPress={() => setSharing(room, n)} />
              ))}
              <Chip label="4+ sharing"selected={room.sharing > 3} onPress={() => room.sharing <= 3 && setSharing(room, 4)} />
            </View>
            {room.sharing > 3 ? (
              <View style={formStyles.spread}>
                <Text style={styles.label}>Beds in this room</Text>
                <CountStepper
                  label="beds"
                  value={room.sharing}
                  min={4}
                  max={MAX_SHARING}
                  onChange={(n) => setSharing(room, n)}
                />
              </View>
            ) : null}
            <Field
              label="Rent per bed (₹ / month)"
              value={room.rent}
              onChangeText={(rent) => patch(room.key, { rent: rent.replace(/[^0-9]/g, '') })}
              placeholder="Not configured"
              keyboardType="number-pad"
              maxLength={String(MAX_RENT_INR).length}
              error={errors.rooms[room.key]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              onPress={() => setOpen(expanded ? null : room.key)}>
              <Text style={styles.link}>{expanded ? 'Hide bed names' : `Beds (${room.sharing}) · name beds`}</Text>
            </Pressable>
            {expanded
              ? labels.map((_, i) => (
                  <Field
                    key={i}
                    label={`Bed ${i + 1}`}
                    value={room.bedLabels[i] ?? ''}
                    placeholder={defaultBedLabel(i)}
                    maxLength={BED_LABEL_MAX}
                    onChangeText={(text) => {
                      const next = [...room.bedLabels];
                      while (next.length < room.sharing) next.push('');
                      next[i] = text;
                      patch(room.key, { bedLabels: next });
                    }}
                  />
                ))
              : null}
          </Card>
          </View>
        );
      })}
      {dialog}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { flex: 1, fontSize: 14, fontWeight: '600', color: BrandColors.textPrimary },
  link: { fontSize: 14, fontWeight: '700', color: BrandColors.accent, paddingVertical: 6 },
});
