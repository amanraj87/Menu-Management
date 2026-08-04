import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, EmptyState, Input, Loader } from '../../ui';
import { useVendorDues } from '../../api/hooks';
import type { VendorDueDay } from '../../api/hooks';
import { colors, font, radius, spacing } from '../../theme';

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Monday of the week containing d. */
function mondayOf(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day));
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

type Preset = { id: string; label: string; range: () => { start: string; end: string } };

const PRESETS: Preset[] = [
  {
    id: 'thisWeek',
    label: 'This week',
    range: () => {
      const mon = mondayOf(new Date());
      return { start: fmt(mon), end: fmt(addDays(mon, 6)) };
    },
  },
  {
    id: 'lastWeek',
    label: 'Last week',
    range: () => {
      const mon = addDays(mondayOf(new Date()), -7);
      return { start: fmt(mon), end: fmt(addDays(mon, 6)) };
    },
  },
  {
    id: 'thisMonth',
    label: 'This month',
    range: () => {
      const n = new Date();
      return {
        start: fmt(new Date(n.getFullYear(), n.getMonth(), 1)),
        end: fmt(new Date(n.getFullYear(), n.getMonth() + 1, 0)),
      };
    },
  },
  {
    id: 'lastMonth',
    label: 'Last month',
    range: () => {
      const n = new Date();
      return {
        start: fmt(new Date(n.getFullYear(), n.getMonth() - 1, 1)),
        end: fmt(new Date(n.getFullYear(), n.getMonth(), 0)),
      };
    },
  },
];

const money = (v: number) => `₹${Math.round(v).toLocaleString('en-IN')}`;
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function dayLabel(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Admin: what's owed to the vendor over a chosen date range. */
export function AdminVendorDuesView({ onRefetchReady }: { onRefetchReady?: (fn: () => void) => void }) {
  const initial = PRESETS[0].range();
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [showEmpty, setShowEmpty] = useState(false);

  // Only query once both dates look complete, so typing doesn't spam the API.
  const validRange = ISO_RE.test(start) && ISO_RE.test(end) && end >= start;
  const { dues, loading, refetch } = useVendorDues(validRange ? start : '', validRange ? end : '');

  React.useEffect(() => {
    onRefetchReady?.(refetch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetch]);

  const activePreset = useMemo(
    () => PRESETS.find(p => {
      const r = p.range();
      return r.start === start && r.end === end;
    })?.id,
    [start, end],
  );

  const rows: VendorDueDay[] = useMemo(() => {
    if (!dues) return [];
    return showEmpty ? dues.days : dues.days.filter(d => d.owed > 0 || d.sentToVendor);
  }, [dues, showEmpty]);

  const hiddenCount = (dues?.days.length ?? 0) - rows.length;

  return (
    <View>
      <Text style={styles.intro}>
        Based on the orders actually sent to the vendor. When the vendor sets their own final amount for a
        day, that amount is what&apos;s owed.
      </Text>

      <View style={styles.presetRow}>
        {PRESETS.map(p => {
          const active = activePreset === p.id;
          return (
            <Pressable
              key={p.id}
              onPress={() => {
                const r = p.range();
                setStart(r.start);
                setEnd(r.end);
              }}
              style={[styles.chip, active && styles.chipOn]}>
              <Text style={[styles.chipText, active && styles.chipTextOn]}>{p.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.dateRow}>
        <View style={styles.flex1}>
          <Input label="From" value={start} onChangeText={setStart} placeholder="YYYY-MM-DD" autoCapitalize="none" />
        </View>
        <View style={styles.flex1}>
          <Input label="To" value={end} onChangeText={setEnd} placeholder="YYYY-MM-DD" autoCapitalize="none" />
        </View>
      </View>

      {!validRange ? (
        <Text style={styles.hint}>Enter both dates as YYYY-MM-DD, with “To” on or after “From”.</Text>
      ) : loading && !dues ? (
        <Loader label="Calculating dues…" />
      ) : !dues ? null : (
        <>
          <Card>
            <Text style={styles.headLabel}>TOTAL OWED TO VENDOR</Text>
            <Text style={styles.headValue}>{money(dues.totalOwed)}</Text>
            <Text style={styles.headSub}>
              {dayLabel(dues.startDate)} – {dayLabel(dues.endDate)}
            </Text>
            <View style={styles.breakdown}>
              <View style={styles.breakRow}>
                <Text style={styles.breakLabel}>Meals</Text>
                <Text style={styles.breakValue}>{money(dues.mealsSubtotal)}</Text>
              </View>
              <View style={styles.breakRow}>
                <Text style={styles.breakLabel}>Delivery</Text>
                <Text style={styles.breakValue}>{money(dues.delivery)}</Text>
              </View>
              {dues.overrideCount > 0 && (
                <View style={styles.breakRow}>
                  <Text style={styles.breakLabel}>Vendor adjustments</Text>
                  <Text style={[styles.breakValue, styles.warn]}>
                    {dues.overrideDelta >= 0 ? '+' : '−'}
                    {money(Math.abs(dues.overrideDelta))}
                  </Text>
                </View>
              )}
            </View>
            {dues.overrideCount > 0 && (
              <Text style={styles.note}>
                ⚑ {dues.overrideCount} day{dues.overrideCount === 1 ? '' : 's'} the vendor set a different amount
              </Text>
            )}
          </Card>

          {rows.length === 0 ? (
            <EmptyState
              icon="🧾"
              title="Nothing owed"
              message="No orders were sent to the vendor in this range."
            />
          ) : (
            <>
              <Card padded={false}>
                {rows.map((d, idx) => (
                  <View key={d.date} style={[styles.row, idx > 0 && styles.rowBorder]}>
                    <View style={styles.flex1}>
                      <Text style={styles.rowDate}>
                        {dayLabel(d.date)}
                        {!d.sentToVendor ? '  · not sent' : ''}
                      </Text>
                      <Text style={styles.rowMeta}>
                        {d.mealsSubtotal > 0 ? `meals ${money(d.mealsSubtotal)}` : 'no meals'}
                        {d.delivery > 0 ? ` · delivery ${money(d.delivery)}` : ''}
                      </Text>
                      {d.hasOverride && (
                        <Text style={styles.rowOverride}>
                          ⚑ vendor set {money(d.vendorFinalAmount ?? 0)} (computed {money(d.computedTotal)})
                        </Text>
                      )}
                    </View>
                    <Text style={styles.rowOwed}>{money(d.owed)}</Text>
                  </View>
                ))}
                <View style={[styles.row, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>{money(dues.totalOwed)}</Text>
                </View>
              </Card>

              {(hiddenCount > 0 || showEmpty) && (
                <Pressable onPress={() => setShowEmpty(s => !s)} style={styles.toggleEmpty}>
                  <Text style={styles.toggleEmptyText}>
                    {showEmpty
                      ? 'Hide days with no orders'
                      : `Show ${hiddenCount} day${hiddenCount === 1 ? '' : 's'} with no orders`}
                  </Text>
                </Pressable>
              )}
            </>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  intro: { color: colors.textMuted, fontSize: font.small, lineHeight: 19, marginBottom: spacing.md },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontSize: font.small, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  dateRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  hint: { color: colors.textMuted, fontSize: font.small, fontStyle: 'italic' },
  headLabel: { color: colors.textMuted, fontSize: font.tiny, fontWeight: '700', letterSpacing: 1 },
  headValue: { color: colors.primary, fontSize: 30, fontWeight: '800', marginTop: 2 },
  headSub: { color: colors.textMuted, fontSize: font.small, marginTop: 2 },
  breakdown: { marginTop: spacing.md, gap: 4 },
  breakRow: { flexDirection: 'row', justifyContent: 'space-between' },
  breakLabel: { color: colors.textMuted, fontSize: font.small },
  breakValue: { color: colors.text, fontSize: font.small, fontWeight: '700' },
  warn: { color: colors.warning },
  note: { color: colors.warning, fontSize: font.tiny, marginTop: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  rowDate: { color: colors.text, fontSize: font.body, fontWeight: '600' },
  rowMeta: { color: colors.textFaint, fontSize: font.tiny, marginTop: 2 },
  rowOverride: { color: colors.warning, fontSize: font.tiny, marginTop: 2 },
  rowOwed: { color: colors.text, fontSize: font.body, fontWeight: '700' },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.borderStrong },
  totalLabel: { color: colors.text, fontSize: font.body, fontWeight: '800', flex: 1 },
  totalValue: { color: colors.primary, fontSize: font.h3, fontWeight: '800' },
  toggleEmpty: { paddingVertical: spacing.md, alignItems: 'center' },
  toggleEmptyText: { color: colors.primary, fontSize: font.small, fontWeight: '600' },
});
