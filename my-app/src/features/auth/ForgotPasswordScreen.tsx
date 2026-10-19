import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { APP_TAGLINE } from '@/constants/brand';
import { BrandColors } from '@/constants/theme';
import {
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from '@/features/auth/authValidation';
import { HostellLogo } from '@/features/auth/HostellLogo';
import { LoginTextField } from '@/features/auth/LoginTextField';
import { requestPasswordReset } from '@/features/auth/passwordReset';

const BACK_ARROW = require('../../../assets/images/assets/Back-Arrow.svg');

type ForgotPasswordScreenProps = {
  initialEmail?: string;
  /** Returns to the screen the user came from. */
  onBack: () => void;
  onShowLogin: () => void;
};

export function ForgotPasswordScreen({
  initialEmail = '',
  onBack,
  onShowLogin,
}: ForgotPasswordScreenProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  // The address the reset email was requested for; set once the request has succeeded.
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isValid },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onChange',
    defaultValues: { email: initialEmail },
  });

  // The email arrives trimmed and lowercased from the schema. An unknown address is reported as
  // success by `requestPasswordReset`, so this never reveals whether an account exists.
  const onSubmit = handleSubmit(async ({ email }) => {
    if (isSubmitting) return;
    setSubmitError(null);
    const error = await requestPasswordReset(email);
    if (error === null) {
      setSentTo(email);
    } else {
      setSubmitError(error.message);
    }
  });

  const onTryAnotherEmail = () => {
    setSentTo(null);
    setSubmitError(null);
    reset({ email: '' });
  };

  const isDisabled = isSubmitting || !isValid;

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.appBar}>
          <HostellLogo />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          <View style={styles.centerArea}>
            <View style={styles.content}>
              {sentTo === null ? (
                <>
                  <View style={styles.heading}>
                    <View style={styles.labelRow}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Go back"
                        onPress={onBack}
                        disabled={isSubmitting}
                        hitSlop={12}>
                        <Image
                          source={BACK_ARROW}
                          style={styles.backIcon}
                          contentFit="contain"
                          tintColor={BrandColors.textPrimary}
                        />
                      </Pressable>
                      <Text style={styles.label}>Account Security</Text>
                    </View>
                    <Text style={styles.title} accessibilityRole="header">
                      Forgot password?
                    </Text>
                    <Text style={styles.subtitle}>
                      No worries. Enter the email address associated with your account, and
                      we&apos;ll help you get back in.
                    </Text>
                  </View>

                  <View style={styles.form}>
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
                      accessibilityLabel="Continue"
                      accessibilityState={{ disabled: isDisabled, busy: isSubmitting }}
                      disabled={isDisabled}
                      onPress={onSubmit}
                      style={[styles.primaryButton, isDisabled && styles.disabled]}>
                      {isSubmitting ? (
                        <ActivityIndicator color={BrandColors.buttonText} />
                      ) : (
                        <View style={styles.primaryButtonContent}>
                          <Text style={styles.primaryButtonText}>Continue</Text>
                          <Text style={styles.primaryButtonText}>{'→'}</Text>
                        </View>
                      )}
                    </Pressable>
                  </View>
                </>
              ) : (
                <View style={styles.confirmation}>
                  <View style={styles.successIcon} accessibilityElementsHidden>
                    <Text style={styles.successGlyph}>{'✓'}</Text>
                  </View>
                  <Text style={styles.title} accessibilityRole="header">
                    Check your inbox
                  </Text>
                  <Text style={styles.confirmationText} accessibilityRole="alert">
                    If an account exists for {sentTo}, we&apos;ve sent password-reset instructions
                    to it. Check your email, including your spam folder.
                  </Text>

                  <Pressable
                    accessibilityRole="button"
                    onPress={onTryAnotherEmail}
                    style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>Try another email</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={onShowLogin} style={styles.signIn}>
                    <Text style={styles.signInLink}>Sign In</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>

          <View style={styles.taglineRow}>
            <View style={styles.taglineLine} />
            <Text style={styles.tagline}>{APP_TAGLINE}</Text>
            <View style={styles.taglineLine} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BrandColors.background },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backIcon: { width: 20, height: 20 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 32,
  },
  centerArea: { flex: 1, justifyContent: 'center' },
  content: { width: '100%', maxWidth: 420, alignSelf: 'center', gap: 28 },
  heading: { gap: 8 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: BrandColors.accent,
  },
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
  confirmation: { alignItems: 'center', gap: 16 },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.accent,
  },
  successGlyph: { fontSize: 34, fontWeight: '800', color: BrandColors.buttonText },
  confirmationText: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: BrandColors.textSecondary,
  },
  secondaryButton: {
    alignSelf: 'stretch',
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BrandColors.border,
    backgroundColor: BrandColors.surface,
  },
  secondaryButtonText: { fontSize: 16, fontWeight: '600', color: BrandColors.textPrimary },
  signIn: { paddingVertical: 8 },
  signInLink: { fontSize: 15, fontWeight: '700', color: BrandColors.accent },
  taglineRow: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8 },
  taglineLine: { width: 40, height: 1, backgroundColor: BrandColors.border },
  tagline: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: BrandColors.textSecondary,
  },
});
