import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../ui/Screen';
import { Badge, Button, Card, EmptyState, Loader, SectionLabel } from '../../ui';
import { SignOutButton } from '../../ui/SignOutButton';
import { useFeedbacksForAdmin } from '../../api/hooks';
import { gqlRequest } from '../../api/client';
import { CONFIRM_FEEDBACK, REJECT_FEEDBACK } from '../../api/operations';
import { useToast } from '../../context/ToastContext';
import { colors, font, spacing } from '../../theme';
import { formatDateTime } from '../../utils/date';
import type { Feedback } from '../../types';

export function AdminFeedbackScreen() {
  const toast = useToast();
  const { feedbacks, loading, refetch } = useFeedbacksForAdmin();
  const [busyId, setBusyId] = useState<string | null>(null);

  const pending = useMemo(
    () => feedbacks.filter(f => f.status === 'pending'),
    [feedbacks],
  );
  const confirmed = useMemo(
    () => feedbacks.filter(f => f.status === 'confirmed'),
    [feedbacks],
  );

  const confirm = async (id: string) => {
    setBusyId(id);
    try {
      await gqlRequest(CONFIRM_FEEDBACK, { id });
      toast.show('Feedback sent to vendor.', 'success');
      refetch();
    } catch (e) {
      toast.show((e as Error).message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (id: string) => {
    setBusyId(id);
    try {
      await gqlRequest(REJECT_FEEDBACK, { id });
      toast.show('Feedback rejected.', 'success');
      refetch();
    } catch (e) {
      toast.show((e as Error).message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const rejected = useMemo(
    () => feedbacks.filter(f => f.status === 'rejected'),
    [feedbacks],
  );

  return (
    <Screen
      title="Feedback"
      subtitle="Review and forward to the vendor"
      headerRight={<SignOutButton />}
      refreshing={loading}
      onRefresh={refetch}>
      {loading && feedbacks.length === 0 ? (
        <Loader label="Loading feedback…" />
      ) : feedbacks.length === 0 ? (
        <EmptyState
          icon="💬"
          title="No feedback yet"
          message="Submissions from people will show up here."
        />
      ) : (
        <>
          <SectionLabel>Pending ({pending.length})</SectionLabel>
          {pending.length === 0 ? (
            <Card>
              <Text style={styles.allClear}>🎉 Nothing to review right now.</Text>
            </Card>
          ) : (
            pending.map(f => (
              <FeedbackCard
                key={f._id}
                feedback={f}
                busy={busyId === f._id}
                onConfirm={() => confirm(f._id)}
                onReject={() => reject(f._id)}
              />
            ))
          )}

          {confirmed.length > 0 ? (
            <>
              <View style={styles.gap} />
              <SectionLabel>Sent to vendor ({confirmed.length})</SectionLabel>
              {confirmed.map(f => (
                <FeedbackCard key={f._id} feedback={f} />
              ))}
            </>
          ) : null}

          {rejected.length > 0 ? (
            <>
              <View style={styles.gap} />
              <SectionLabel>Rejected ({rejected.length})</SectionLabel>
              {rejected.map(f => (
                <FeedbackCard key={f._id} feedback={f} />
              ))}
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function FeedbackCard({
  feedback,
  busy,
  onConfirm,
  onReject,
}: {
  feedback: Feedback;
  busy?: boolean;
  onConfirm?: () => void;
  onReject?: () => void;
}) {
  const statusLabel = feedback.status === 'confirmed' ? 'Confirmed' : feedback.status === 'rejected' ? 'Rejected' : 'Pending';
  const statusTone = feedback.status === 'confirmed' ? 'primary' : feedback.status === 'rejected' ? 'danger' : 'warning';
  return (
    <Card>
      <View style={styles.head}>
        <View style={styles.flex1}>
          <Text style={styles.author}>{feedback.userName}</Text>
          <Text style={styles.time}>{formatDateTime(feedback.createdAt)}</Text>
        </View>
        <Badge label={statusLabel} tone={statusTone as any} />
      </View>
      <Text style={styles.text}>{feedback.text}</Text>
      {onConfirm && onReject ? (
        <View style={styles.actionRow}>
          <Button
            title="Confirm"
            icon="✓"
            onPress={onConfirm}
            loading={busy}
            style={styles.actionBtn}
          />
          <Button
            title="Reject"
            icon="✕"
            variant="danger"
            onPress={onReject}
            loading={busy}
            style={styles.actionBtn}
          />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  author: { color: colors.text, fontSize: font.body, fontWeight: '700' },
  time: { color: colors.textFaint, fontSize: font.tiny, marginTop: 2 },
  text: { color: colors.textMuted, fontSize: font.body, lineHeight: 21 },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  actionBtn: { flex: 1 },
  allClear: { color: colors.textMuted, fontSize: font.body, textAlign: 'center' },
  gap: { height: spacing.sm },
});
