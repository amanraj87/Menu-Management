import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../ui/Screen';
import { Card, EmptyState, Loader, Segmented } from '../../ui';
import { SignOutButton } from '../../ui/SignOutButton';
import { useMenuItems } from '../../api/hooks';
import { gqlRequest } from '../../api/client';
import { SET_MENU_ITEM_OFFERED_DAYS } from '../../api/operations';
import { useToast } from '../../context/ToastContext';
import { colors, font, mealMeta, radius, spacing } from '../../theme';
import { MEAL_TYPES, type MealType, type MenuItem } from '../../types';

// Display order Mon → Sun; values are JS weekdays (0=Sun … 6=Sat).
const WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: 'M' },
  { value: 2, label: 'T' },
  { value: 3, label: 'W' },
  { value: 4, label: 'T' },
  { value: 5, label: 'F' },
  { value: 6, label: 'S' },
  { value: 0, label: 'S' },
];

export function AdminMenuScreen() {
  const toast = useToast();
  const [meal, setMeal] = useState<MealType>('breakfast');
  const { items, loading, refetch } = useMenuItems();
  const [overrides, setOverrides] = useState<Record<string, number[]>>({});
  const [pending, setPending] = useState<Set<string>>(new Set());

  const filtered = useMemo(
    () =>
      items
        .filter(i => i.mealType === meal)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [items, meal],
  );

  const daysOf = (item: MenuItem): number[] => overrides[item._id] ?? item.offeredDays;

  const save = async (item: MenuItem, next: number[]) => {
    const prev = daysOf(item);
    setOverrides(o => ({ ...o, [item._id]: next }));
    setPending(p => new Set(p).add(item._id));
    try {
      await gqlRequest(SET_MENU_ITEM_OFFERED_DAYS, { id: item._id, days: next });
      await refetch();
    } catch (e) {
      setOverrides(o => ({ ...o, [item._id]: prev })); // revert
      toast.show((e as Error).message, 'error');
    } finally {
      setPending(p => {
        const n = new Set(p);
        n.delete(item._id);
        return n;
      });
    }
  };

  const toggleDay = (item: MenuItem, day: number) => {
    const days = daysOf(item);
    const next = days.includes(day)
      ? days.filter(d => d !== day)
      : [...days, day].sort((a, b) => a - b);
    save(item, next);
  };

  return (
    <Screen
      title="Menu"
      subtitle="Pick which days each dish is available"
      headerRight={<SignOutButton />}
      refreshing={loading}
      onRefresh={refetch}>
      <Segmented
        value={meal}
        onChange={setMeal}
        options={MEAL_TYPES.map(m => ({
          value: m,
          label: mealMeta[m].label,
          icon: mealMeta[m].icon,
        }))}
      />

      {loading && !items.length ? (
        <Loader label="Loading menu…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={mealMeta[meal].icon}
          title={`No ${mealMeta[meal].label.toLowerCase()} dishes`}
          message="The vendor adds dishes from their Menu page."
        />
      ) : (
        <Card padded={false}>
          {filtered.map((item, idx) => {
            const days = daysOf(item);
            const busy = pending.has(item._id);
            return (
              <View
                key={item._id}
                style={[styles.item, idx > 0 && styles.itemBorder, days.length === 0 && styles.itemOff]}>
                <View style={styles.head}>
                  <Text style={styles.name}>{item.name}</Text>
                  {item.pricePerUnit != null ? (
                    <Text style={styles.summary}>₹{item.pricePerUnit} /{item.unit}</Text>
                  ) : null}
                </View>
                <View style={styles.dayRow}>
                  {WEEKDAYS.map((d, i) => {
                    const on = days.includes(d.value);
                    return (
                      <Pressable
                        key={i}
                        disabled={busy}
                        onPress={() => toggleDay(item, d.value)}
                        style={[styles.dayChip, on && styles.dayChipOn, busy && styles.dayChipBusy]}>
                        <Text style={[styles.dayChipText, on && styles.dayChipTextOn]}>{d.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  itemBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  itemOff: { opacity: 0.55 },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  name: { color: colors.text, fontSize: font.body, fontWeight: '600', flex: 1 },
  summary: { color: colors.textMuted, fontSize: font.small },
  dayRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  dayChip: {
    width: 36,
    height: 34,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayChipBusy: { opacity: 0.6 },
  dayChipText: { color: colors.textMuted, fontSize: font.small, fontWeight: '700' },
  dayChipTextOn: { color: '#fff' },
});
