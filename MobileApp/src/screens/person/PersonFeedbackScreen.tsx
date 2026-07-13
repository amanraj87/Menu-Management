import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../ui/Screen';
import { Button, Card, Input, SectionLabel } from '../../ui';
import { FeedbackBubbles } from '../../ui/FeedbackBubbles';
import { SignOutButton } from '../../ui/SignOutButton';
import { gqlRequest } from '../../api/client';
import { CREATE_FEEDBACK } from '../../api/operations';
import { useMyFeedbacks } from '../../api/hooks';
import { useToast } from '../../context/ToastContext';
import { colors, font, spacing } from '../../theme';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Awaiting admin review',
  confirmed: 'Shared with vendor',
  rejected: 'Not taken up',
};

export function PersonFeedbackScreen() {
  const toast = useToast();
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);
  const { feedbacks, loading, refetch } = useMyFeedbacks();

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setPending(true);
    try {
      await gqlRequest(CREATE_FEEDBACK, { input: { text: trimmed } });
      setText('');
      toast.show('Feedback submitted. Thank you!', 'success');
      refetch();
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
      headerRight={<SignOutButton />}
      refreshing={loading}
      onRefresh={refetch}>
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

      {feedbacks.length > 0 ? (
        <>
          <View style={styles.spacer} />
          <SectionLabel>Your feedback ({feedbacks.length})</SectionLabel>
          {feedbacks.map(f => (
            <Card key={f._id}>
              <FeedbackBubbles feedback={f} viewer="user" />
              {!f.vendorReply ? (
                <Text style={styles.statusLine}>{STATUS_LABEL[f.status] ?? f.status}</Text>
              ) : null}
            </Card>
          ))}
        </>
      ) : null}
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
  statusLine: { color: colors.textFaint, fontSize: font.tiny, textAlign: 'right', marginTop: 4 },
});
