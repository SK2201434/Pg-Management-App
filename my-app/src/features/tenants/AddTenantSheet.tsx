import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/app-button';
import { BrandColors } from '@/constants/theme';
import { selectOwner } from '@/features/auth/ownerAuthSelectors';
import { Chip } from '@/features/properties/addProperty/formParts';
import type { Property } from '@/features/properties/propertyTypes';
import { buildTenantInviteMessage, createTenantInvite, TENANT_INVITE_DAYS } from '@/features/tenants/tenantInvite';
import { useAppSelector } from '@/store/hooks';

type Props = {
  properties: readonly Property[];
  /** The property chosen on the screen, or null for "All Properties" (the owner must then choose). */
  initialPropertyId: string | null;
  onClose: () => void;
};

// Add Tenant. Tenants join a property by creating an account with a single-use code from the owner
// (the existing referral flow adds them as a member of that property). This creates that code for the
// chosen property and shares it. It saves only after "Create invite code"; nothing is written on open.
// Mount only while open (fresh state).
export function AddTenantSheet({ properties, initialPropertyId, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const ownerUid = useAppSelector(selectOwner)?.uid;
  const [propertyId, setPropertyId] = useState<string | null>(initialPropertyId ?? (properties.length === 1 ? properties[0].id : null));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<{ code: string; propertyName: string; expiresMs: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const create = async () => {
    const property = properties.find((p) => p.id === propertyId);
    if (!property || ownerUid === undefined || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { code, expiresMs } = await createTenantInvite(property.id, ownerUid);
      setInvite({ code, propertyName: property.name, expiresMs });
    } catch (e) {
      const code = (e as { code?: string } | null)?.code;
      setError(code === 'permission-denied' ? 'The invite was rejected. You may not have access to this property.' : 'Could not create the invite. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (!invite) return;
    try {
      await Share.share({ message: buildTenantInviteMessage(invite.propertyName, invite.code) });
    } catch {
      setMessage('Could not open the share sheet.');
    }
  };
  const copy = async () => {
    if (!invite) return;
    try {
      setMessage((await Clipboard.setStringAsync(invite.code)) ? 'Code copied.' : 'Could not copy the code.');
    } catch {
      setMessage('Could not copy the code.');
    }
  };

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={busy ? undefined : onClose}>
      <View style={styles.root}>
        <Pressable accessibilityLabel="Dismiss" disabled={busy} style={StyleSheet.absoluteFill} onPress={onClose} />
        <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.handle} />
          <Text accessibilityRole="header" style={styles.title}>
            Add tenant
          </Text>
          {invite ? (
            <>
              <Text style={styles.body}>
                Give this code to your tenant for {invite.propertyName}. They create a tenant account in HOSTELL and enter it; they then appear in this property’s tenants.
              </Text>
              <View style={styles.codeBox} accessible accessibilityLabel={`Invite code ${invite.code}`}>
                <Text selectable style={styles.code}>
                  {invite.code}
                </Text>
              </View>
              <Text style={styles.muted}>
                Works once, expires in {TENANT_INVITE_DAYS} days ({new Date(invite.expiresMs).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}).
              </Text>
              <View style={styles.actions}>
                <AppButton icon="share" label="Share" onPress={share} style={styles.action} />
                <AppButton variant="secondary" icon="content-copy" label="Copy code" onPress={copy} style={styles.action} />
              </View>
              {message ? <Text style={styles.muted}>{message}</Text> : null}
              <AppButton variant="ghost" label="Done" onPress={onClose} />
            </>
          ) : (
            <>
              <Text style={styles.body}>Choose the property the tenant will join. We create a single-use invite code for it.</Text>
              <View style={styles.chips}>
                {properties.map((p) => (
                  <Chip key={p.id} label={p.name} selected={propertyId === p.id} onPress={() => setPropertyId(p.id)} />
                ))}
              </View>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={styles.actions}>
                <AppButton variant="secondary" label="Cancel" disabled={busy} onPress={onClose} style={styles.action} />
                <AppButton label="Create invite code" loading={busy} disabled={propertyId === null} onPress={create} style={styles.action} />
              </View>
              {busy ? <ActivityIndicator color={BrandColors.accent} /> : null}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(32, 42, 43, 0.45)' },
  sheet: { gap: 12, paddingTop: 8, paddingHorizontal: 16, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: BrandColors.surface },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: BrandColors.border },
  title: { fontSize: 18, fontWeight: '800', color: BrandColors.textPrimary },
  body: { fontSize: 14, lineHeight: 20, color: BrandColors.textSecondary },
  muted: { fontSize: 12, color: BrandColors.textSecondary },
  error: { fontSize: 13, color: BrandColors.error },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  codeBox: { alignItems: 'center', padding: 16, borderRadius: 12, backgroundColor: BrandColors.canvas },
  code: { fontSize: 15, fontWeight: '800', letterSpacing: 1, color: BrandColors.textPrimary },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1 },
});
