import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../ui/Screen';
import { Card, EmptyState, Loader } from '../../ui';
import { SignOutButton } from '../../ui/SignOutButton';
import { useConfirmedFeedbacks } from '../../api/hooks';
import { colors, font, spacing } from '../../theme';
import { formatDateTime } from '../../utils/date';

export function VendorFeedbackScreen() {
  const { feedbacks, loading, refetch } = useConfirmedFeedbacks();

  return (
    <Screen
      title="Feedback"
      subtitle="Confirmed suggestions from the team"
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
        feedbacks.map(f => (
          <Card key={f._id}>
            <View style={styles.head}>
              <Text style={styles.author}>{f.userName}</Text>
              <Text style={styles.time}>
                {formatDateTime(f.confirmedAt ?? f.createdAt)}
              </Text>
            </View>
            <Text style={styles.text}>{f.text}</Text>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  author: { color: colors.text, fontSize: font.body, fontWeight: '700' },
  time: { color: colors.textFaint, fontSize: font.tiny },
  text: { color: colors.textMuted, fontSize: font.body, lineHeight: 21 },
});
