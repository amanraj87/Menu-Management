import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Input } from '../../ui';
import { colors, font, radius, spacing } from '../../theme';
import { gqlRequest } from '../../api/client';
import { LOGIN, RESET_PASSWORD, SIGN_UP } from '../../api/operations';
import { useSession } from '../../context/SessionContext';
import { useToast } from '../../context/ToastContext';
import type { UserRole } from '../../types';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

type AuthMode = 'signin' | 'signup' | 'reset';

export function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn } = useSession();
  const toast = useToast();

  const [mode, setMode] = useState<AuthMode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);

  const isSignUp = mode === 'signup';
  const isReset = mode === 'reset';

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
  };

  const handleSuccess = async (user: AuthUser) => {
    await signIn({ userId: user.id, role: user.role, name: user.name });
  };

  const submit = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) return toast.show('Enter your email.', 'warning');
    if (!password)
      return toast.show(
        isReset ? 'Enter a new password.' : 'Enter your password.',
        'warning',
      );

    setPending(true);
    try {
      if (isReset) {
        if (password.length < 4) {
          setPending(false);
          return toast.show('Password must be at least 4 characters.', 'warning');
        }
        if (password !== confirmPassword) {
          setPending(false);
          return toast.show('Passwords do not match.', 'warning');
        }
        await gqlRequest(RESET_PASSWORD, {
          email: trimmedEmail,
          newPasswordHash: password,
        });
        toast.show('Password updated. Please sign in.', 'success');
        switchMode('signin');
        return;
      }

      if (isSignUp) {
        const trimmedName = name.trim();
        if (!trimmedName) {
          setPending(false);
          return toast.show('Enter your name.', 'warning');
        }
        const data = await gqlRequest<{ signUp: AuthUser }>(SIGN_UP, {
          input: { name: trimmedName, email: trimmedEmail, passwordHash: password },
        });
        await handleSuccess(data.signUp);
      } else {
        const data = await gqlRequest<{ login: AuthUser }>(LOGIN, {
          email: trimmedEmail,
          passwordHash: password,
        });
        if (!data.login) throw new Error('Login failed');
        await handleSuccess(data.login);
      }
    } catch (e) {
      const msg = (e as Error).message;
      toast.show(
        msg === 'User not found'
          ? 'No account found for this email.' +
              (isReset ? '' : ' Sign up first.')
          : msg,
        'error',
      );
    } finally {
      setPending(false);
    }
  };

  const title = isReset
    ? 'Reset password'
    : isSignUp
    ? 'Create your account'
    : 'Welcome back';
  const subtitle = isReset
    ? 'Enter your email and choose a new password.'
    : isSignUp
    ? 'Sign up to start choosing your meals.'
    : 'Sign in with your email and password.';
  const submitLabel = isReset
    ? 'Update password'
    : isSignUp
    ? 'Sign up'
    : 'Sign in';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Text style={styles.logoIcon}>🍽️</Text>
            </View>
            <Text style={styles.brandName}>FoodOps</Text>
            <Text style={styles.brandTagline}>Plan meals. Combine orders. Feed everyone.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.cardSubtitle}>{subtitle}</Text>

            <View style={styles.form}>
              {isSignUp && (
                <Input
                  label="Name"
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  autoCapitalize="words"
                />
              )}
              <Input
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Input
                label={isReset ? 'New password' : 'Password'}
                value={password}
                onChangeText={setPassword}
                placeholder={
                  isReset
                    ? 'Choose a new password'
                    : isSignUp
                    ? 'Choose a password'
                    : 'Your password'
                }
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                rightSlot={
                  <Pressable
                    onPress={() => setShowPassword(v => !v)}
                    hitSlop={8}
                    style={styles.eye}>
                    <Text style={styles.eyeText}>
                      {showPassword ? '🙈' : '👁️'}
                    </Text>
                  </Pressable>
                }
              />
              {isReset && (
                <Input
                  label="Confirm new password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter your new password"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
              )}

              {!isSignUp && !isReset && (
                <Pressable
                  onPress={() => switchMode('reset')}
                  hitSlop={8}
                  style={styles.forgot}>
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </Pressable>
              )}

              <Button
                title={submitLabel}
                onPress={submit}
                loading={pending}
                fullWidth
                size="lg"
                style={styles.submit}
              />
            </View>

            <View style={styles.switchRow}>
              {isReset ? (
                <>
                  <Text style={styles.switchText}>Remembered it?</Text>
                  <Pressable onPress={() => switchMode('signin')} hitSlop={8}>
                    <Text style={styles.switchLink}>Back to sign in</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.switchText}>
                    {isSignUp ? 'Already have an account?' : 'New here?'}
                  </Text>
                  <Pressable
                    onPress={() => switchMode(isSignUp ? 'signin' : 'signup')}
                    hitSlop={8}>
                    <Text style={styles.switchLink}>
                      {isSignUp ? 'Sign in' : 'Create an account'}
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex1: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  brand: { alignItems: 'center', marginBottom: spacing.xxl },
  logo: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  logoIcon: { fontSize: 36 },
  brandName: { color: colors.text, fontSize: 30, fontWeight: '900' },
  brandTagline: {
    color: colors.textMuted,
    fontSize: font.small,
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
  },
  cardTitle: { color: colors.text, fontSize: font.h2, fontWeight: '800' },
  cardSubtitle: {
    color: colors.textMuted,
    fontSize: font.small,
    marginTop: 6,
    marginBottom: spacing.lg,
  },
  form: { marginTop: spacing.sm },
  submit: { marginTop: spacing.sm },
  eye: { paddingHorizontal: 4 },
  eyeText: { fontSize: 18 },
  forgot: { alignSelf: 'flex-end', marginTop: -spacing.xs, marginBottom: spacing.sm },
  forgotText: { color: colors.primary, fontSize: font.small, fontWeight: '700' },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
    gap: 6,
  },
  switchText: { color: colors.textMuted, fontSize: font.small },
  switchLink: { color: colors.primary, fontSize: font.small, fontWeight: '700' },
});
