import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font, spacing } from '../theme';
import { formatDateTime } from '../utils/date';
import type { Feedback } from '../types';

type Viewer = 'user' | 'vendor' | 'admin';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

function Bubble({ side, header, avatar, text }: { side: 'left' | 'right'; header: string; avatar?: string; text: string }) {
  if (side === 'left') {
    return (
      <View style={styles.leftRow}>
        {avatar != null ? (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{avatar}</Text>
          </View>
        ) : null}
        <View style={styles.leftWrap}>
          <Text style={styles.meta}>{header}</Text>
          <View style={styles.incomingBubble}>
            <Text style={styles.incomingText}>{text}</Text>
          </View>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.rightWrap}>
      <Text style={styles.metaRight}>{header}</Text>
      <View style={styles.outgoingBubble}>
        <Text style={styles.outgoingText}>{text}</Text>
      </View>
    </View>
  );
}

/** Renders a feedback + optional vendor reply as a chat thread from `viewer`'s perspective. */
export function FeedbackBubbles({ feedback: f, viewer, hideReply }: { feedback: Feedback; viewer: Viewer; hideReply?: boolean }) {
  const userSide: 'left' | 'right' = viewer === 'user' ? 'right' : 'left';
  const vendorSide: 'left' | 'right' = viewer === 'user' ? 'left' : 'right';
  const userHeader = `${viewer === 'user' ? 'You' : f.userName} · ${formatDateTime(f.createdAt)}`;
  const vendorHeader = `${viewer === 'vendor' ? 'You (vendor)' : 'Vendor'}${f.vendorReplyAt ? ` · ${formatDateTime(f.vendorReplyAt)}` : ''}`;
  return (
    <View style={{ gap: spacing.sm }}>
      <Bubble side={userSide} header={userHeader} avatar={userSide === 'left' ? initials(f.userName) : undefined} text={f.text} />
      {f.vendorReply && !hideReply ? (
        <Bubble side={vendorSide} header={vendorHeader} avatar={vendorSide === 'left' ? '👨‍🍳' : undefined} text={f.vendorReply} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  leftRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primary, fontSize: font.tiny, fontWeight: '800' },
  leftWrap: { flex: 1 },
  meta: { color: colors.textFaint, fontSize: font.tiny, marginBottom: 3, marginLeft: 4 },
  metaRight: { color: colors.textFaint, fontSize: font.tiny, marginBottom: 3, marginRight: 4, textAlign: 'right' },
  incomingBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomLeftRadius: 16,
    maxWidth: '92%',
  },
  incomingText: { color: colors.text, fontSize: font.body, lineHeight: 20 },
  rightWrap: { alignItems: 'flex-end' },
  outgoingBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 16,
    borderBottomLeftRadius: 16,
    maxWidth: '88%',
  },
  outgoingText: { color: '#04140a', fontSize: font.body, lineHeight: 20, fontWeight: '500' },
});
