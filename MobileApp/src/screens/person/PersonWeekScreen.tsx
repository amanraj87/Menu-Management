import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../ui/Screen';
import {
  Button,
  Card,
  EmptyState,
  Loader,
  SectionLabel,
  Stepper,
} from '../../ui';
import { Sheet } from '../../ui/Sheet';
import { Input } from '../../ui';
import { SignOutButton } from '../../ui/SignOutButton';
import { useMenuItems, useMySelectionsForWeek, useMyMealOptOuts, useMyMealDoneForWeek } from '../../api/hooks';
import { gqlRequest } from '../../api/client';
import { MY_SELECTIONS_FOR_WEEK, PUT_SELECTION, TOGGLE_MEAL_OPT_OUT, MY_MEAL_OPT_OUTS, MARK_MEAL_DONE, MY_MEAL_DONE_FOR_WEEK } from '../../api/operations';
import { useToast } from '../../context/ToastContext';
import { colors, font, mealMeta, radius, spacing } from '../../theme';
import {
  addDays,
  dayOfMonth,
  dayShort,
  formatShort,
  isToday,
  todayISO,
  weekDays,
  weekStart,
} from '../../utils/date';
import { MEAL_TYPES, type MealType } from '../../types';

const key = (date: string, meal: MealType, itemId: string) =>
  `${date}|${meal}|${itemId}`;

function MealToggle({
  value,
  onToggle,
  disabled,
}: {
  value: boolean;
  onToggle: () => void;
  disabled: boolean;
}) {
  const anim = React.useRef(new Animated.Value(value ? 1 : 0)).current;
  React.useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [value, anim]);

  const trackBg = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.secondary, colors.primary],
  });
  const thumbLeft = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 20],
  });

  return (
    <Pressable onPress={disabled ? undefined : onToggle} hitSlop={6}>
      <Animated.View
        style={[
          toggleStyles.track,
          { backgroundColor: trackBg },
          disabled && toggleStyles.trackDisabled,
        ]}>
        <Animated.View
          style={[toggleStyles.thumb, { left: thumbLeft }]}
        />
      </Animated.View>
    </Pressable>
  );
}

const toggleStyles = StyleSheet.create({
  track: {
    width: 40,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
  },
  trackDisabled: {
    opacity: 0.4,
  },
  thumb: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fff',
  },
});

function canToggleMeal(date: string): boolean {
  const today = todayISO();
  return date > today;
}

export function PersonWeekScreen() {
  const toast = useToast();
  const [start, setStart] = useState(() => weekStart(todayISO()));
  const [activeDay, setActiveDay] = useState(() => {
    const t = todayISO();
    return weekStart(t) === weekStart(todayISO()) ? t : weekStart(todayISO());
  });
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [sheetMeal, setSheetMeal] = useState<MealType | null>(null);
  const [search, setSearch] = useState('');

  const menu = useMenuItems();
  const sel = useMySelectionsForWeek(start);
  const optOutsQuery = useMyMealOptOuts(start);
  const doneQuery = useMyMealDoneForWeek(start);
  const [localOptOuts, setLocalOptOuts] = useState<Set<string>>(new Set());
  const [localDone, setLocalDone] = useState<Set<string>>(new Set());
  const days = useMemo(() => weekDays(start), [start]);

  useEffect(() => {
    const next = new Set<string>();
    optOutsQuery.optOuts.forEach(o => next.add(`${o.date}|${o.mealType}`));
    setLocalOptOuts(next);
  }, [JSON.stringify(optOutsQuery.optOuts)]);

  const isMealOptedOut = (date: string, meal: MealType) =>
    localOptOuts.has(`${date}|${meal}`);

  const handleToggleMeal = async (date: string, meal: MealType) => {
    const k = `${date}|${meal}`;
    const currentlyOptedOut = localOptOuts.has(k);
    const newOptedOut = !currentlyOptedOut;
    setLocalOptOuts(prev => {
      const next = new Set(prev);
      if (newOptedOut) next.add(k);
      else next.delete(k);
      return next;
    });
    try {
      await gqlRequest(TOGGLE_MEAL_OPT_OUT, {
        date,
        mealType: meal,
        optedOut: newOptedOut,
      });
    } catch (e) {
      setLocalOptOuts(prev => {
        const next = new Set(prev);
        if (currentlyOptedOut) next.add(k);
        else next.delete(k);
        return next;
      });
      toast.show((e as Error).message, 'error');
    }
  };

  useEffect(() => {
    const next = new Set<string>();
    doneQuery.doneList.forEach(d => next.add(`${d.date}|${d.mealType}`));
    setLocalDone(next);
  }, [JSON.stringify(doneQuery.doneList)]);

  const isMealDone = (date: string, meal: MealType) =>
    localDone.has(`${date}|${meal}`);

  const handleMarkDone = async (date: string, meal: MealType) => {
    const k = `${date}|${meal}`;
    const currentlyDone = localDone.has(k);
    const newDone = !currentlyDone;
    setLocalDone(prev => {
      const next = new Set(prev);
      if (newDone) next.add(k);
      else next.delete(k);
      return next;
    });
    try {
      await gqlRequest(MARK_MEAL_DONE, {
        date,
        mealType: meal,
        done: newDone,
      });
    } catch (e) {
      setLocalDone(prev => {
        const next = new Set(prev);
        if (currentlyDone) next.add(k);
        else next.delete(k);
        return next;
      });
      toast.show((e as Error).message, 'error');
    }
  };

  // Seed local quantities from server selections whenever the week changes.
  useEffect(() => {
    const next: Record<string, number> = {};
    sel.selections.forEach(s => {
      s.items.forEach(it => {
        next[key(s.date, s.mealType, it.menuItemId)] = it.quantity;
      });
    });
    setQuantities(next);
    setDirty(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(sel.selections)]);

  const itemMap = useMemo(() => {
    const m = new Map(menu.items.map(i => [i._id, i]));
    return m;
  }, [menu.items]);

  const setQty = (date: string, meal: MealType, itemId: string, qty: number) => {
    setQuantities(prev => {
      const next = { ...prev };
      if (qty <= 0) delete next[key(date, meal, itemId)];
      else next[key(date, meal, itemId)] = qty;
      return next;
    });
    setDirty(prev => new Set(prev).add(`${date}|${meal}`));
  };

  const selectedForMeal = (date: string, meal: MealType) => {
    const prefix = `${date}|${meal}|`;
    return Object.entries(quantities)
      .filter(([k]) => k.startsWith(prefix))
      .map(([k, qty]) => {
        const itemId = k.slice(prefix.length);
        return { itemId, qty, item: itemMap.get(itemId) };
      })
      .filter(r => r.item);
  };

  const saveWeek = async () => {
    if (dirty.size === 0) {
      toast.show('Nothing to save.', 'info');
      return;
    }
    setSaving(true);
    try {
      for (const dm of dirty) {
        const [date, meal] = dm.split('|') as [string, MealType];
        const items = selectedForMeal(date, meal).map(r => ({
          menuItemId: r.itemId,
          quantity: r.qty,
        }));
        await gqlRequest(PUT_SELECTION, {
          input: { date, mealType: meal, items },
        });
      }
      setDirty(new Set());
      toast.show('Your week is saved!', 'success');
      sel.refetch();
    } catch (e) {
      toast.show((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const importLastWeek = async () => {
    setImporting(true);
    try {
      const lastStart = addDays(start, -7);
      const data = await gqlRequest<{ mySelectionsForWeek: any[] }>(
        MY_SELECTIONS_FOR_WEEK,
        { startDate: lastStart },
      );
      const next = { ...quantities };
      const touched = new Set(dirty);
      (data.mySelectionsForWeek ?? []).forEach(s => {
        // shift each date forward by 7 days into the current week
        const targetDate = addDays(s.date, 7);
        s.items.forEach((it: any) => {
          next[key(targetDate, s.mealType, it.menuItemId)] = it.quantity;
          touched.add(`${targetDate}|${s.mealType}`);
        });
      });
      setQuantities(next);
      setDirty(touched);
      toast.show('Imported last week. Review and save.', 'success');
    } catch (e) {
      toast.show((e as Error).message, 'error');
    } finally {
      setImporting(false);
    }
  };

  const sheetItems = useMemo(() => {
    if (!sheetMeal) return [];
    const chosen = new Set(
      selectedForMeal(activeDay, sheetMeal).map(r => r.itemId),
    );
    const q = search.trim().toLowerCase();
    return menu.items
      .filter(i => i.mealType === sheetMeal && !chosen.has(i._id))
      .filter(i => !q || i.name.toLowerCase().includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetMeal, menu.items, search, quantities, activeDay]);

  const loading = menu.loading || sel.loading;

  return (
    <Screen
      title="Plan my week"
      headerRight={<SignOutButton />}
      refreshing={loading}
      onRefresh={() => {
        menu.refetch();
        sel.refetch();
      }}>
      {/* Week navigation */}
      <View style={styles.weekNav}>
        <Pressable
          style={styles.navBtn}
          onPress={() => setStart(addDays(start, -7))}
          hitSlop={8}>
          <Text style={styles.navBtnText}>‹</Text>
        </Pressable>
        <View style={styles.weekLabelWrap}>
          <Text style={styles.weekLabel}>Week of {formatShort(start)}</Text>
        </View>
        <Pressable
          style={styles.navBtn}
          onPress={() => setStart(addDays(start, 7))}
          hitSlop={8}>
          <Text style={styles.navBtnText}>›</Text>
        </Pressable>
      </View>

      <Button
        title="Import from last week"
        icon="↻"
        variant="ghost"
        loading={importing}
        onPress={importLastWeek}
      />

      {/* Day strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dayStrip}>
        {days.map(d => {
          const active = d === activeDay;
          const today = isToday(d);
          return (
            <Pressable
              key={d}
              onPress={() => setActiveDay(d)}
              style={[styles.dayChip, active && styles.dayChipActive]}>
              <Text
                style={[styles.dayChipDow, active && styles.dayChipTextActive]}>
                {dayShort(d)}
              </Text>
              <Text
                style={[styles.dayChipNum, active && styles.dayChipTextActive]}>
                {dayOfMonth(d)}
              </Text>
              {today ? <View style={styles.todayDot} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>

      {loading && !menu.items.length ? (
        <Loader label="Loading your selections…" />
      ) : (
        MEAL_TYPES.map(meal => {
          const rows = selectedForMeal(activeDay, meal);
          const meta = mealMeta[meal];
          const optedOut = isMealOptedOut(activeDay, meal);
          const toggleEnabled = canToggleMeal(activeDay);
          return (
            <Card key={meal} padded={false} style={optedOut ? styles.cardOptedOut : undefined}>
              <View style={styles.mealHeader}>
                <Text style={styles.mealIcon}>{meta.icon}</Text>
                <Text style={[styles.mealTitle, optedOut && styles.mealTitleOptedOut]}>{meta.label}</Text>
                <View style={styles.flex1} />
                <View style={styles.toggleWrap}>
                  {!toggleEnabled && (
                    <Text style={styles.toggleHint}>
                      {activeDay <= todayISO() ? '' : ''}
                    </Text>
                  )}
                  <MealToggle
                    value={!optedOut}
                    onToggle={() => handleToggleMeal(activeDay, meal)}
                    disabled={!toggleEnabled}
                  />
                </View>
              </View>

              {optedOut ? (
                <Text style={styles.optedOutRow}>
                  {toggleEnabled ? "You've skipped this meal" : 'Meal locked for today'}
                </Text>
              ) : (
                <>
                  {rows.length === 0 ? (
                    <Text style={styles.emptyRow}>No items yet</Text>
                  ) : (
                    rows.map(r => (
                      <View key={r.itemId} style={styles.itemRow}>
                        <View style={styles.flex1}>
                          <Text style={styles.itemName}>{r.item!.name}</Text>
                          <Text style={styles.itemUnit}>per {r.item!.unit}</Text>
                        </View>
                        <Stepper
                          value={r.qty}
                          onChange={v => setQty(activeDay, meal, r.itemId, v)}
                        />
                      </View>
                    ))
                  )}

                  <Pressable
                    style={styles.addRow}
                    onPress={() => {
                      setSearch('');
                      setSheetMeal(meal);
                    }}>
                    <Text style={styles.addText}>＋ Add an item</Text>
                  </Pressable>

                  {activeDay <= todayISO() && (
                    <Pressable
                      style={[
                        styles.doneRow,
                        isMealDone(activeDay, meal) && styles.doneRowActive,
                      ]}
                      onPress={() => handleMarkDone(activeDay, meal)}>
                      <Text style={styles.doneIcon}>
                        {isMealDone(activeDay, meal) ? '✓' : '○'}
                      </Text>
                      <Text
                        style={[
                          styles.doneText,
                          isMealDone(activeDay, meal) && styles.doneTextActive,
                        ]}>
                        {isMealDone(activeDay, meal) ? 'Eaten' : 'Mark as eaten'}
                      </Text>
                    </Pressable>
                  )}
                </>
              )}
            </Card>
          );
        })
      )}

      <Button
        title={dirty.size > 0 ? `Save my week (${dirty.size})` : 'Save my week'}
        onPress={saveWeek}
        loading={saving}
        fullWidth
        size="lg"
      />

      {/* Add-item sheet */}
      <Sheet
        visible={sheetMeal !== null}
        onClose={() => setSheetMeal(null)}
        title={sheetMeal ? `Add ${mealMeta[sheetMeal].label}` : 'Add item'}>
        <Input
          placeholder="Search items…"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
        {sheetItems.length === 0 ? (
          <EmptyState
            icon="🔎"
            title="No items"
            message="Nothing matches, or all items are already added."
          />
        ) : (
          <View style={styles.sheetList}>
            <SectionLabel>Tap to add</SectionLabel>
            {sheetItems.map(item => (
              <Pressable
                key={item._id}
                style={styles.sheetItem}
                onPress={() => {
                  if (sheetMeal) setQty(activeDay, sheetMeal, item._id, 1);
                  setSheetMeal(null);
                }}>
                <View style={styles.flex1}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemUnit}>
                    per {item.unit}
                    {item.pricePerUnit != null ? ` · ₹${item.pricePerUnit}` : ''}
                  </Text>
                </View>
                <Text style={styles.sheetAdd}>＋</Text>
              </Pressable>
            ))}
          </View>
        )}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnText: { color: colors.primary, fontSize: 22, fontWeight: '700' },
  weekLabelWrap: { flex: 1, alignItems: 'center' },
  weekLabel: { color: colors.text, fontSize: font.body, fontWeight: '700' },

  dayStrip: { gap: spacing.sm, paddingVertical: spacing.xs },
  dayChip: {
    width: 52,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  dayChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayChipDow: { color: colors.textMuted, fontSize: font.tiny, fontWeight: '700' },
  dayChipNum: {
    color: colors.text,
    fontSize: font.h3,
    fontWeight: '800',
    marginTop: 2,
  },
  dayChipTextActive: { color: '#04140a' },
  todayDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.warning,
    marginTop: 3,
  },

  cardOptedOut: {
    opacity: 0.5,
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  mealIcon: { fontSize: 18, marginRight: spacing.sm },
  mealTitle: { color: colors.text, fontSize: font.h3, fontWeight: '700' },
  mealTitleOptedOut: { color: colors.textFaint, textDecorationLine: 'line-through' as const },
  toggleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  toggleHint: {
    color: colors.textFaint,
    fontSize: font.tiny,
  },
  optedOutRow: {
    color: colors.textFaint,
    fontSize: font.small,
    fontStyle: 'italic',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  emptyRow: {
    color: colors.textFaint,
    fontSize: font.small,
    fontStyle: 'italic',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  itemName: { color: colors.text, fontSize: font.body, fontWeight: '600' },
  itemUnit: { color: colors.textFaint, fontSize: font.tiny, marginTop: 2 },
  addRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  addText: { color: colors.primary, fontSize: font.small, fontWeight: '700' },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  doneRowActive: {
    backgroundColor: 'rgba(34,197,94,0.08)',
  },
  doneIcon: {
    fontSize: 16,
    color: colors.textMuted,
  },
  doneText: {
    color: colors.textMuted,
    fontSize: font.small,
    fontWeight: '600',
  },
  doneTextActive: {
    color: colors.success,
    fontWeight: '700',
  },

  sheetList: { marginTop: spacing.sm },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sheetAdd: { color: colors.primary, fontSize: 22, fontWeight: '700', paddingHorizontal: 6 },
});
