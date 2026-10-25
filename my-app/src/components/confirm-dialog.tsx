import { useCallback, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { BrandColors } from '@/constants/theme';

export type ConfirmOptions = {
  title: string;
  message?: string;
  /** Defaults to "Confirm". */
  confirmLabel?: string;
  /** Defaults to "Cancel". */
  cancelLabel?: string;
  /** Styles the confirm button as a destructive action (delete, discard, remove). */
  destructive?: boolean;
};

type ConfirmDialogProps = ConfirmOptions & {
  visible: boolean;
  /** Shows a spinner on the confirm button and disables both buttons. */
  busy?: boolean;
  onConfirm: () => void;
  /** Cancel button, tapping the backdrop and the Android back button. */
  onCancel: () => void;
};

// The app-wide confirmation popup. Prefer `useConfirm` below, which gives an awaitable
// `confirm({...})`; use this component directly only when the dialog's visibility is driven by
// other state (e.g. to keep it open while the confirmed action runs: pass `busy`).
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive,
  busy,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={busy ? undefined : onCancel}>
      <View style={styles.root}>
        <Pressable
          accessibilityLabel="Dismiss"
          style={StyleSheet.absoluteFill}
          disabled={busy}
          onPress={onCancel}
        />
        <View accessibilityViewIsModal style={styles.dialog}>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.actions}>
            <AppButton
              variant="secondary"
              label={cancelLabel}
              disabled={busy}
              onPress={onCancel}
              style={styles.action}
            />
            <AppButton
              variant={destructive ? 'destructive' : 'primary'}
              label={confirmLabel}
              loading={busy}
              onPress={onConfirm}
              style={styles.action}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

type Pending = ConfirmOptions & { resolve: (confirmed: boolean) => void };

/**
 * Awaitable confirmation:
 *
 *   const { confirm, dialog } = useConfirm();
 *   if (await confirm({ title: 'Discard changes?', destructive: true })) { ... }
 *   return <>{...}{dialog}</>;   // render `dialog` once anywhere in the screen
 *
 * Resolves `true` on confirm and `false` on cancel, backdrop tap or Android back.
 */
export function useConfirm(): { confirm: (options: ConfirmOptions) => Promise<boolean>; dialog: ReactNode } {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  );

  const settle = (confirmed: boolean) => {
    pending?.resolve(confirmed);
    setPending(null);
  };

  const dialog = (
    <ConfirmDialog
      visible={pending !== null}
      title={pending?.title ?? ''}
      message={pending?.message}
      confirmLabel={pending?.confirmLabel}
      cancelLabel={pending?.cancelLabel}
      destructive={pending?.destructive}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  );

  return { confirm, dialog };
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(32, 42, 43, 0.45)',
  },
  dialog: {
    width: '100%',
    maxWidth: 380,
    gap: 8,
    padding: 20,
    borderRadius: 24,
    backgroundColor: BrandColors.surface,
    elevation: 8,
  },
  title: { fontSize: 18, fontWeight: '800', color: BrandColors.textPrimary },
  message: { fontSize: 14, lineHeight: 20, color: BrandColors.textSecondary },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  action: { flex: 1 },
});
