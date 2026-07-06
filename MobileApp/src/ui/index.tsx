import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { colors, font, radius, shadow, spacing } from '../theme';

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: string;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  fullWidth,
  icon,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const palette = buttonPalette[variant];
  const sizing = buttonSizing[size];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          paddingVertical: sizing.py,
          paddingHorizontal: sizing.px,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
        fullWidth && styles.btnFull,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={palette.text} size="small" />
      ) : (
        <View style={styles.btnRow}>
          {icon ? (
            <Text style={[styles.btnIcon, { color: palette.text }]}>{icon}</Text>
          ) : null}
          <Text
            style={[
              styles.btnText,
              { color: palette.text, fontSize: sizing.font },
            ]}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const buttonPalette: Record<
  ButtonVariant,
  { bg: string; border: string; text: string }
> = {
  primary: { bg: colors.primary, border: colors.primary, text: '#04140a' },
  secondary: {
    bg: colors.secondary,
    border: colors.secondary,
    text: colors.text,
  },
  outline: { bg: 'transparent', border: colors.borderStrong, text: colors.text },
  ghost: { bg: 'transparent', border: 'transparent', text: colors.primary },
  danger: { bg: colors.dangerSoft, border: colors.danger, text: colors.danger },
};

const buttonSizing: Record<
  ButtonSize,
  { py: number; px: number; font: number }
> = {
  sm: { py: 7, px: 12, font: font.small },
  md: { py: 12, px: 18, font: font.body },
  lg: { py: 15, px: 22, font: font.h3 },
};

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  style?: ViewStyle;
  padded?: boolean;
}

export function Card({
  children,
  title,
  subtitle,
  right,
  style,
  padded = true,
}: CardProps) {
  return (
    <View style={[styles.card, style]}>
      {(title || right) && (
        <View style={styles.cardHeader}>
          <View style={styles.flex1}>
            {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
            {subtitle ? (
              <Text style={styles.cardSubtitle}>{subtitle}</Text>
            ) : null}
          </View>
          {right}
        </View>
      )}
      <View style={padded ? styles.cardBody : undefined}>{children}</View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Input                                                               */
/* ------------------------------------------------------------------ */

interface InputProps extends TextInputProps {
  label?: string;
  hint?: string;
  rightSlot?: React.ReactNode;
}

export function Input({ label, hint, rightSlot, style, ...rest }: InputProps) {
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={styles.inputWrap}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
      <View
        style={[
          styles.inputBox,
          focused && styles.inputBoxFocused,
          rightSlot ? styles.inputBoxRow : null,
        ]}>
        <TextInput
          placeholderTextColor={colors.textFaint}
          style={[styles.input, style]}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...rest}
        />
        {rightSlot}
      </View>
      {hint ? <Text style={styles.inputHint}>{hint}</Text> : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Badge                                                               */
/* ------------------------------------------------------------------ */

type BadgeTone = 'neutral' | 'primary' | 'warning' | 'danger' | 'info';

export function Badge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: BadgeTone;
}) {
  const tones: Record<BadgeTone, { bg: string; fg: string }> = {
    neutral: { bg: colors.surfaceAlt, fg: colors.textMuted },
    primary: { bg: colors.primarySoft, fg: colors.primary },
    warning: { bg: colors.warningSoft, fg: colors.warning },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    info: { bg: 'rgba(56,189,248,0.16)', fg: colors.info },
  };
  const t = tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.badgeText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Segmented control                                                   */
/* ------------------------------------------------------------------ */

interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segment}>
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[styles.segmentItem, active && styles.segmentItemActive]}>
            <Text
              style={[
                styles.segmentText,
                active && styles.segmentTextActive,
              ]}>
              {opt.icon ? `${opt.icon} ` : ''}
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Stepper (quantity control)                                          */
/* ------------------------------------------------------------------ */

export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
}) {
  const dec = () => onChange(Math.max(min, round(value - step)));
  const inc = () => onChange(round(value + step));
  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={dec}
        style={styles.stepBtn}
        hitSlop={6}
        disabled={value <= min}>
        <Text
          style={[styles.stepBtnText, value <= min && styles.stepBtnDisabled]}>
          −
        </Text>
      </Pressable>
      <Text style={styles.stepValue}>{formatQty(value)}</Text>
      <Pressable onPress={inc} style={styles.stepBtn} hitSlop={6}>
        <Text style={styles.stepBtnText}>+</Text>
      </Pressable>
    </View>
  );
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
export function formatQty(n: number): string {
  return Number.isInteger(n) ? `${n}` : `${n}`;
}

/* ------------------------------------------------------------------ */
/* Loader / Empty / Divider / Row                                      */
/* ------------------------------------------------------------------ */

export function Loader({ label }: { label?: string }) {
  return (
    <View style={styles.loader}>
      <ActivityIndicator color={colors.primary} size="large" />
      {label ? <Text style={styles.loaderText}>{label}</Text> : null}
    </View>
  );
}

export function EmptyState({
  icon = '🍽️',
  title,
  message,
}: {
  icon?: string;
  title: string;
  message?: string;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={styles.emptyMessage}>{message}</Text> : null}
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  flex1: { flex: 1 },

  btn: {
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnFull: { alignSelf: 'stretch' },
  btnRow: { flexDirection: 'row', alignItems: 'center' },
  btnText: { fontWeight: '700' },
  btnIcon: { fontSize: 15, marginRight: 6, fontWeight: '700' },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  cardTitle: { color: colors.text, fontSize: font.h3, fontWeight: '700' },
  cardSubtitle: {
    color: colors.textMuted,
    fontSize: font.small,
    marginTop: 2,
  },
  cardBody: { padding: spacing.lg },

  inputWrap: { marginBottom: spacing.md },
  inputLabel: {
    color: colors.textMuted,
    fontSize: font.small,
    marginBottom: 6,
    fontWeight: '600',
  },
  inputBox: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  inputBoxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.sm,
  },
  inputBoxFocused: {
    borderColor: colors.primary,
  },
  input: {
    color: colors.text,
    fontSize: font.body,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    flex: 1,
  },
  inputHint: {
    color: colors.textFaint,
    fontSize: font.tiny,
    marginTop: 4,
  },

  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: font.tiny, fontWeight: '700' },

  segment: {
    flexDirection: 'row',
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  segmentItemActive: {
    backgroundColor: colors.primary,
  },
  segmentText: {
    color: colors.textMuted,
    fontSize: font.small,
    fontWeight: '600',
  },
  segmentTextActive: { color: '#04140a', fontWeight: '800' },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { color: colors.primary, fontSize: 20, fontWeight: '700' },
  stepBtnDisabled: { color: colors.textFaint },
  stepValue: {
    color: colors.text,
    fontSize: font.body,
    fontWeight: '700',
    minWidth: 26,
    textAlign: 'center',
  },

  loader: { paddingVertical: spacing.xxl, alignItems: 'center' },
  loaderText: { color: colors.textMuted, marginTop: spacing.md },

  empty: { paddingVertical: spacing.xxl, alignItems: 'center' },
  emptyIcon: { fontSize: 40, marginBottom: spacing.md },
  emptyTitle: { color: colors.text, fontSize: font.h3, fontWeight: '700' },
  emptyMessage: {
    color: colors.textMuted,
    fontSize: font.small,
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },

  sectionLabel: {
    color: colors.textFaint,
    fontSize: font.tiny,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
});
