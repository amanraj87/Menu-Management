import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../ui/Screen';
import { Button, Card, Input } from '../../ui';
import { SignOutButton } from '../../ui/SignOutButton';
import { gqlRequest } from '../../api/client';
import { CREATE_FEEDBACK } from '../../api/operations';
import { useToast } from '../../context/ToastContext';
import { colors, font, spacing } from '../../theme';

export function PersonFeedbackScreen() {
  const toast = useToast();
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setPending(true);
    try {
      await gqlRequest(CREATE_FEEDBACK, { input: { text: trimmed } });
      setText('');
      toast.show('Feedback submitted. Thank you!', 'success');
    } catch (e) {
      toast.show((e as Error).message, 'error');
    } finally {
      setPending(false);
    }
  };

  return (
    <Screen
      title="Feedback"
      subtitle="Share suggestions with the team"
      headerRight={<SignOutButton />}>
      <Card>
        <Text style={styles.lead}>
          Tell the admin what you'd like to see — new dishes, portion tweaks, or
          anything else. Confirmed feedback gets shared with the vendor.
        </Text>
        <View style={styles.spacer} />
        <Input
          placeholder="Write your feedback…"
          value={text}
          onChangeText={setText}
          multiline
          numberOfLines={6}
          style={styles.textarea}
        />
        <Button
          title="Submit feedback"
          icon="✉️"
          onPress={submit}
          loading={pending}
          disabled={!text.trim()}
          fullWidth
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { color: colors.textMuted, fontSize: font.body, lineHeight: 21 },
  spacer: { height: spacing.md },
  textarea: {
    minHeight: 130,
    textAlignVertical: 'top',
    paddingTop: spacing.md,
  },
});
