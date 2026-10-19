import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { APP_TAGLINE } from '@/constants/brand';
import { AccountRoles, type AccountType } from '@/constants/account';
import { BrandColors } from '@/constants/theme';
import { getAuthErrorMessage } from '@/features/auth/authErrorMessage';
import {
  ownerRegisterFormSchema,
  type OwnerRegisterFormInput,
} from '@/features/auth/authValidation';
import { HostellLogo } from '@/features/auth/HostellLogo';
import { LoginTextField } from '@/features/auth/LoginTextField';
import { registerOwnerThunk } from '@/features/auth/ownerAuthSlice';
import { useAppDispatch } from '@/store/hooks';

type OwnerRegisterScreenProps = { onShowLogin: () => void };

// The selected account type is signup intent only. It changes the copy and the button, and is not
// sent anywhere yet: registration is the same Firebase flow for both, and the actual role must be
// assigned by trusted provisioning, never by the client.
const MODE_COPY: Record<
  AccountType,
  { title: string; subtitle: string; button: string; switchLabel: string; switchIcon: string }
> = {
  [AccountRoles.Tenant]: {
    title: 'Create your account',
    subtitle: 'Find your space. Make yourself at home.',
    button: 'Create Tenant Account',
    switchLabel: 'Register as a Property Owner',
    switchIcon: '⌂',
  },
  [AccountRoles.Owner]: {
    title: 'Create your owner account',
    subtitle: 'Manage your properties and tenants with ease.',
    button: 'Create Owner Account',
    switchLabel: 'Register as a Tenant',
    switchIcon: '☺',
  },
};

export function OwnerRegisterScreen({ onShowLogin }: OwnerRegisterScreenProps) {
  const dispatch = useAppDispatch();
  const { width: windowWidth } = useWindowDimensions();
  const [mode, setMode] = useState<AccountType>(AccountRoles.Tenant);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Where the dropdown opens (under the three-dot button); null while the menu is closed.
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const menuButtonRef = useRef<View>(null);
  const copy = MODE_COPY[mode];

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OwnerRegisterFormInput>({
    resolver: zodResolver(ownerRegisterFormSchema),
    defaultValues: { full_name: '', email: '', phone: '', password: '', confirm_password: '' },
  });

  // Registering also signs the user in; OwnerAuthGate then swaps this screen out. `phone` and
  // `confirm_password` are validated on the client and not sent: registration has no phone field.
  const onSubmit = handleSubmit(async ({ full_name, email, password }) => {
    if (isSubmitting) return;
    setSubmitError(null);
    try {
      await dispatch(registerOwnerThunk({ full_name, email, password })).unwrap();
    } catch (error) {
      setSubmitError(getAuthErrorMessage(error));
    }
  });

  const openMenu = () => {
    menuButtonRef.current?.measureInWindow((x, y, width, height) => {
      setMenuPosition({ top: y + height + 4, right: Math.max(windowWidth - (x + width), 8) });
    });
  };
  const closeMenu = () => setMenuPosition(null);
  const switchMode = () => {
    setMode((current) => (current === AccountRoles.Tenant ? AccountRoles.Owner : AccountRoles.Tenant));
    setSubmitError(null);
    closeMenu();
  };

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.appBar}>
          <HostellLogo />
          <Pressable
            ref={menuButtonRef}
            accessibilityRole="button"
            accessibilityLabel="Account type menu"
            onPress={openMenu}
            disabled={isSubmitting}
            hitSlop={8}
            style={styles.menuButton}>
            <Text style={styles.menuGlyph}>⋮</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          <View style={styles.centerArea}>
          <View style={styles.content}>
            <View style={styles.heading}>
              <Text style={styles.title} accessibilityRole="header">
                {copy.title}
              </Text>
              <Text style={styles.subtitle}>{copy.subtitle}</Text>
            </View>

            <View style={styles.form}>
              <LoginTextField
                control={control}
                name="full_name"
                label="Full name"
                error={errors.full_name?.message}
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                returnKeyType="next"
                editable={!isSubmitting}
              />
              <LoginTextField
                control={control}
                name="email"
                label="Email address"
                error={errors.email?.message}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                textContentType="emailAddress"
                returnKeyType="next"
                editable={!isSubmitting}
              />
              <LoginTextField
                control={control}
                name="phone"
                label="Phone number"
                error={errors.phone?.message}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                returnKeyType="next"
                editable={!isSubmitting}
              />
              <LoginTextField
                control={control}
                name="password"
                label="Create password"
                isPassword
                error={errors.password?.message}
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="next"
                editable={!isSubmitting}
              />
              <LoginTextField
                control={control}
                name="confirm_password"
                label="Confirm password"
                isPassword
                error={errors.confirm_password?.message}
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="done"
                onSubmitEditing={onSubmit}
                editable={!isSubmitting}
              />

              {submitError ? (
                <Text style={styles.errorText} accessibilityRole="alert">
                  {submitError}
                </Text>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={copy.button}
                accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }}
                disabled={isSubmitting}
                onPress={onSubmit}
                style={[styles.primaryButton, isSubmitting && styles.disabled]}>
                {isSubmitting ? (
                  <ActivityIndicator color={BrandColors.buttonText} />
                ) : (
                  <View style={styles.primaryButtonContent}>
                    <Text style={styles.primaryButtonText}>{copy.button}</Text>
                    <Text style={styles.primaryButtonText}>{'→'}</Text>
                  </View>
                )}
              </Pressable>
            </View>

            <View style={styles.motif} accessibilityElementsHidden>
              <View style={styles.motifLine} />
              <View style={styles.motifDot} />
              <View style={styles.motifLine} />
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={onShowLogin}
              disabled={isSubmitting}
              style={styles.signIn}>
              <Text style={styles.signInText}>
                Already have an account? <Text style={styles.signInLink}>Sign In</Text>
              </Text>
            </Pressable>
          </View>
          </View>

          <View style={styles.taglineRow}>
            <View style={styles.taglineLine} />
            <Text style={styles.tagline}>{APP_TAGLINE}</Text>
            <View style={styles.taglineLine} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={menuPosition !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeMenu}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={closeMenu}
          accessibilityLabel="Close menu">
          <View style={[styles.menu, { top: menuPosition?.top ?? 0, right: menuPosition?.right ?? 24 }]}>
            <Pressable accessibilityRole="menuitem" onPress={switchMode} style={styles.menuItem}>
              <Text style={styles.menuItemIcon}>{copy.switchIcon}</Text>
              <Text style={styles.menuItemText}>{copy.switchLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BrandColors.background },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  menuButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  menuGlyph: { fontSize: 26, fontWeight: '700', color: BrandColors.textPrimary },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 32,
  },
  centerArea: { flex: 1, justifyContent: 'center' },
  content: { width: '100%', maxWidth: 420, alignSelf: 'center', gap: 24 },
  heading: { gap: 8 },
  title: { fontSize: 32, lineHeight: 40, fontWeight: '800', color: BrandColors.textPrimary },
  subtitle: { fontSize: 16, lineHeight: 24, color: BrandColors.textSecondary },
  form: { gap: 14 },
  errorText: { fontSize: 14, color: BrandColors.error },
  primaryButton: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: BrandColors.buttonBackground,
  },
  primaryButtonContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  primaryButtonText: { fontSize: 16, fontWeight: '700', color: BrandColors.buttonText },
  disabled: { opacity: 0.6 },
  motif: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  motifLine: { width: 48, height: StyleSheet.hairlineWidth, backgroundColor: BrandColors.border },
  motifDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: BrandColors.accent },
  signIn: { alignItems: 'center', paddingVertical: 4 },
  signInText: { fontSize: 15, color: BrandColors.textSecondary },
  signInLink: { fontWeight: '700', color: BrandColors.accent },
  taglineRow: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8 },
  taglineLine: { width: 40, height: 1, backgroundColor: BrandColors.border },
  tagline: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: BrandColors.textSecondary,
  },
  menu: {
    position: 'absolute',
    minWidth: 240,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BrandColors.border,
    backgroundColor: BrandColors.surface,
    paddingVertical: 6,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuItemIcon: { fontSize: 18, color: BrandColors.accent },
  menuItemText: { fontSize: 15, fontWeight: '600', color: BrandColors.textPrimary },
});
