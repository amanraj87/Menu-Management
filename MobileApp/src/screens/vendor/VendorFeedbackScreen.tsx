import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '../../ui/Screen';
import { Card, EmptyState, Loader } from '../../ui';
import { FeedbackBubbles } from '../../ui/FeedbackBubbles';
import { SignOutButton } from '../../ui/SignOutButton';
import { useConfirmedFeedbacks } from '../../api/hooks';
import { gqlRequest } from '../../api/client';
import { REPLY_TO_FEEDBACK } from '../../api/operations';
import { useToast } from '../../context/ToastContext';
import { colors, font, radius, spacing } from '../../theme';
import type { Feedback } from '../../types';

export function VendorFeedbackScreen() {
  const { feedbacks, loading, refetch } = useConfirmedFeedbacks();

  return (
    <Screen
      title="Feedback"
      subtitle="Reply to reach the admin and the user"
      headerRight={<SignOutButton />}
      refreshing={loading}
      onRefresh={refetch}>
      {loading && feedbacks.length === 0 ? (
        <Loader label="Loading feedback…" />
      ) : feedbacks.length === 0 ? (
        <EmptyState
          icon="💬"
          title="No feedback yet"
          message="Feedback confirmed by the admin will appear here."
        />
      ) : (
        feedbacks.map(f => <ConversationCard key={f._id} feedback={f} onReplied={refetch} />)
      )}
    </Screen>
  );
}

function ConversationCard({ feedback: f, onReplied }: { feedback: Feedback; onReplied: () => void }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const composerOpen = editing || !f.vendorReply;

  const send = async () => {
    const reply = text.trim();
    if (!reply) return;
    setSaving(true);
    try {
      await gqlRequest(REPLY_TO_FEEDBACK, { id: f._id, reply });
      toast.show('Reply sent to admin and the user.', 'success');
      setEditing(false);
      setText('');
      onReplied();
    } catch (e) {
      toast.show((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <FeedbackBubbles feedback={f} viewer="vendor" hideReply={editing} />

      {f.vendorReply && !editing ? (
        <View style={styles.editRow}>
          <Pressable onPress={() => { setEditing(true); setText(f.vendorReply ?? ''); }} hitSlop={6}>
            <Text style={styles.editLink}>✎ Edit reply</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Composer */}
      {composerOpen ? (
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Write a reply…"
            placeholderTextColor={colors.textFaint}
            multiline
          />
          {editing ? (
            <Pressable onPress={() => { setEditing(false); setText(''); }} hitSlop={6}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={send}
            disabled={saving || !text.trim()}
            style={[styles.sendBtn, text.trim() ? styles.sendBtnActive : styles.sendBtnIdle]}>
            <Text style={[styles.sendIcon, text.trim() ? styles.sendIconActive : styles.sendIconIdle]}>{saving ? '…' : '➤'}</Text>
          </Pressable>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  editRow: { alignItems: 'flex-end', marginTop: 4 },
  editLink: { color: colors.textMuted, fontSize: font.tiny, paddingHorizontal: 4 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.md },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: font.body,
    maxHeight: 110,
    backgroundColor: colors.surface,
  },
  cancel: { color: colors.textMuted, fontSize: font.small, paddingVertical: 10, paddingHorizontal: 2 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  sendBtnActive: { backgroundColor: colors.primary },
  sendBtnIdle: { backgroundColor: colors.border },
  sendIcon: { fontSize: 16 },
  sendIconActive: { color: '#04140a' },
  sendIconIdle: { color: colors.textMuted },
});
