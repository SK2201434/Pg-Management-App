import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { APP_TAGLINE } from "@/constants/brand";
import { BrandColors } from "@/constants/theme";
import { getAuthErrorMessage } from "@/features/auth/authErrorMessage";
import {
  ownerLoginSchema,
  type OwnerLoginFormValues,
} from "@/features/auth/authValidation";
import { HostellLogo } from "@/features/auth/HostellLogo";
import { LoginTextField } from "@/features/auth/LoginTextField";
import { selectAuthLoading } from "@/features/auth/ownerAuthSelectors";
import {
  loginOwnerThunk,
  loginWithGoogleThunk,
} from "@/features/auth/ownerAuthSlice";
import { requestPasswordReset } from "@/features/auth/passwordReset";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

const GOOGLE_LOGO = require("../../../assets/images/assets/Google_Logo.png");

type OwnerLoginScreenProps = { onShowRegister: () => void };

const RESET_SENT_MESSAGE =
  "If an account exists for this email, a password reset link has been sent.";

type ResetFeedback = { kind: "success" | "error"; text: string };

export function OwnerLoginScreen({ onShowRegister }: OwnerLoginScreenProps) {
  const dispatch = useAppDispatch();
  const { login: isLoginPending, google: isGooglePending } =
    useAppSelector(selectAuthLoading);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [resetFeedback, setResetFeedback] = useState<ResetFeedback | null>(
    null,
  );

  const {
    control,
    handleSubmit,
    getValues,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<OwnerLoginFormValues>({
    resolver: zodResolver(ownerLoginSchema),
    defaultValues: { email: "", password: "" },
  });

  const isSigningIn = isSubmitting || isLoginPending;
  const isBusy = isSigningIn || isResetting || isGooglePending;

  // Signing in updates the Firebase auth state, which OwnerAuthGate observes and then swaps
  // this screen out. The email arrives trimmed from the schema.
  const onSubmit = handleSubmit(async (values) => {
    if (isBusy) return;
    setSubmitError(null);
    setResetFeedback(null);
    try {
      await dispatch(loginOwnerThunk(values)).unwrap();
    } catch (error) {
      setSubmitError(getAuthErrorMessage(error));
    }
  });

  // Google sign-in also ends in the Firebase auth state, so OwnerAuthGate swaps this screen out.
  // Closing the Google dialog is not an error and shows nothing.
  const onGoogleSignIn = async () => {
    if (isBusy) return;
    setSubmitError(null);
    setResetFeedback(null);
    try {
      await dispatch(loginWithGoogleThunk()).unwrap();
    } catch (error) {
      setSubmitError(getAuthErrorMessage(error));
    }
  };

  const onForgotPassword = async () => {
    if (isBusy) return;
    setSubmitError(null);
    setResetFeedback(null);

    // Validates only the email field and shows its message (e.g. "Email is required.").
    if (!(await trigger("email"))) return;

    setIsResetting(true);
    const error = await requestPasswordReset(getValues("email").trim().toLowerCase());
    setIsResetting(false);
    setResetFeedback(
      error === null
        ? { kind: "success", text: RESET_SENT_MESSAGE }
        : { kind: "error", text: error.message },
    );
  };

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.centerArea}>
            <View style={styles.content}>
              <View style={styles.brandRow}>
                <HostellLogo />
              </View>

              <View style={styles.heading}>
                <Text style={styles.title} accessibilityRole="header">
                  Welcome back
                </Text>
                <Text style={styles.subtitle}>
                  Sign in to manage your stay or property.
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
                  returnKeyType="next"
                  editable={!isBusy}
                />
                <LoginTextField
                  control={control}
                  name="password"
                  label="Password"
                  isPassword
                  error={errors.password?.message}
                  autoCapitalize="none"
                  autoComplete="current-password"
                  textContentType="password"
                  returnKeyType="done"
                  onSubmitEditing={onSubmit}
                  editable={!isBusy}
                />

                <Pressable
                  accessibilityRole="button"
                  onPress={onForgotPassword}
                  disabled={isBusy}
                  hitSlop={8}
                  style={styles.forgot}
                >
                  <Text style={styles.forgotText}>
                    {isResetting ? "Sending reset link..." : "Forgot password?"}
                  </Text>
                </Pressable>

                {submitError ? (
                  <Text style={styles.errorText} accessibilityRole="alert">
                    {submitError}
                  </Text>
                ) : null}
                {resetFeedback ? (
                  <Text
                    style={
                      resetFeedback.kind === "error"
                        ? styles.errorText
                        : styles.successText
                    }
                    accessibilityRole="alert"
                  >
                    {resetFeedback.text}
                  </Text>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Sign In"
                  accessibilityState={{ disabled: isBusy, busy: isSigningIn }}
                  disabled={isBusy}
                  onPress={onSubmit}
                  style={[styles.primaryButton, isBusy && styles.disabled]}
                >
                  {isSigningIn ? (
                    <ActivityIndicator color={BrandColors.buttonText} />
                  ) : (
                    <View style={styles.primaryButtonContent}>
                      <Text style={styles.primaryButtonText}>Sign In</Text>
                      <Text style={styles.primaryButtonText}>{"→"}</Text>
                    </View>
                  )}
                </Pressable>
              </View>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.googleBlock}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Continue with Google"
                  accessibilityState={{
                    disabled: isBusy,
                    busy: isGooglePending,
                  }}
                  disabled={isBusy}
                  onPress={onGoogleSignIn}
                  style={[styles.googleButton, isBusy && styles.disabled]}
                >
                  {isGooglePending ? (
                    <ActivityIndicator color={BrandColors.accent} />
                  ) : (
                    <>
                      <Image
                        source={GOOGLE_LOGO}
                        style={styles.googleLogo}
                        resizeMode="contain"
                      />
                      <Text style={styles.googleText}>Continue with Google</Text>
                    </>
                  )}
                </Pressable>
              </View>

              <Pressable
                accessibilityRole="button"
                onPress={onShowRegister}
                disabled={isBusy}
                style={styles.createAccount}
              >
                <Text style={styles.createAccountText}>
                  New here?{" "}
                  <Text style={styles.createAccountLink}>
                    Create an account
                  </Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BrandColors.background },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    gap: 32,
  },
  centerArea: { flex: 1, justifyContent: "center" },
  content: { width: "100%", maxWidth: 420, alignSelf: "center", gap: 28 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  heading: { gap: 8 },
  title: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "800",
    color: BrandColors.textPrimary,
  },
  subtitle: { fontSize: 16, lineHeight: 24, color: BrandColors.textSecondary },
  form: { gap: 14 },
  forgot: { alignSelf: "flex-end" },
  forgotText: { fontSize: 14, fontWeight: "600", color: BrandColors.accent },
  errorText: { fontSize: 14, color: BrandColors.error },
  successText: { fontSize: 14, color: BrandColors.textPrimary },
  primaryButton: {
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: BrandColors.buttonBackground,
  },
  primaryButtonContent: { flexDirection: "row", alignItems: "center", gap: 10 },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: BrandColors.buttonText,
  },
  disabled: { opacity: 0.6 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: BrandColors.border,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
    color: BrandColors.textSecondary,
  },
  googleBlock: { gap: 8 },
  googleButton: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BrandColors.border,
    backgroundColor: BrandColors.surface,
  },
  googleLogo: { width: 20, height: 20 },
  googleText: {
    fontSize: 16,
    fontWeight: "600",
    color: BrandColors.textPrimary,
  },
  note: { fontSize: 13, textAlign: "center", color: BrandColors.textSecondary },
  createAccount: { alignItems: "center", paddingVertical: 4 },
  createAccountText: { fontSize: 15, color: BrandColors.textSecondary },
  createAccountLink: { fontWeight: "700", color: BrandColors.accent },
  taglineRow: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  taglineLine: {
    width: 40,
    height: 1,
    backgroundColor: BrandColors.border,
  },
  tagline: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: BrandColors.textSecondary,
  },
});
