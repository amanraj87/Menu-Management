import React from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { colors, font, radius, spacing } from '../theme';
import { useSession } from '../context/SessionContext';

export function SignOutButton() {
  const { signOut, session } = useSession();
  const confirm = () => {
    Alert.alert('Sign out', `Sign out of ${session?.name ?? 'your account'}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          signOut();
        },
      },
    ]);
  };
  return (
    <Pressable onPress={confirm} hitSlop={8} style={styles.btn}>
      <Text style={styles.text}>Sign out</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  text: { color: colors.textMuted, fontSize: font.small, fontWeight: '600' },
});
