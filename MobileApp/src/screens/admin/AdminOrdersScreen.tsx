import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../ui/Screen';
import {
  Button,
  Card,
  EmptyState,
  Loader,
  SectionLabel,
  Segmented,
  Stepper,
  Input,
} from '../../ui';
import { Sheet } from '../../ui/Sheet';
import { SignOutButton } from '../../ui/SignOutButton';
import { useAggregatedOrder, useMenuItems, useMealDoneStatus, useWeeklyExpense } from '../../api/hooks';
import { gqlRequest } from '../../api/client';
import { AGGREGATED_ORDER, CONFIRM_ORDER_WITH_ITEMS } from '../../api/operations';
import { useToast } from '../../context/ToastContext';
import { colors, font, mealMeta, radius, spacing } from '../../theme';
import { addDays, formatShort, isToday, todayISO, weekDays, weekStart } from '../../utils/date';
import { MEAL_TYPES, type MealType, type PersonBreakdownItem } from '../../types';

interface EditableItem {
  menuItemId: string;
  name: string;
  unit: string;
  quantity: number;
  personBreakdown: PersonBreakdownItem[];
}

export function AdminOrdersScreen() {
  const toast = useToast();
  const [date, setDate] = useState(todayISO());
  const [meal, setMeal] = useState<MealType>('breakfast');
  const [items, setItems] = useState<EditableItem[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [confirming, setConfirming] = useState(false);

  const [wkStart, setWkStart] = useState(() => weekStart(todayISO()));
  const [weekConfirming, setWeekConfirming] = useState(false);
  const [weekProgress, setWeekProgress] = useState('');

  const { aggregated, loading, refetch } = useAggregatedOrder(date, meal);
  const menu = useMenuItems(meal);
  const { doneUsers, refetch: refetchDone } = useMealDoneStatus(date, meal);
  const { weeklyExpense, loading: weeklyExpenseLoading } = useWeeklyExpense(wkStart);

  useEffect(() => {
    setItems(
      aggregated.items.map(i => ({
        menuItemId: i.menuItemId,
        name: i.name,
        unit: i.unit,
        quantity: i.quantity,
        personBreakdown: i.personBreakdown ?? [],
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(aggregated.items)]);

  const setQty = (id: string, qty: number) =>
    setItems(prev =>
      prev.map(i => (i.menuItemId === id ? { ...i, quantity: qty } : i)),
    );

  const remove = (id: string) =>
    setItems(prev => prev.filter(i => i.menuItemId !== id));

  const toggle = (id: string) =>
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const addItem = (menuItemId: string, name: string, unit: string) => {
    setItems(prev =>
      prev.some(i => i.menuItemId === menuItemId)
        ? prev
        : [...prev, { menuItemId, name, unit, quantity: 1, personBreakdown: [] }],
    );
    setSheetOpen(false);
  };

  const confirm = async () => {
    setConfirming(true);
    try {
      await gqlRequest(CONFIRM_ORDER_WITH_ITEMS, {
        date,
        mealType: meal,
        items: items
          .filter(i => i.quantity > 0)
          .map(i => ({
            menuItemId: i.menuItemId,
            name: i.name,
            unit: i.unit,
            quantity: i.quantity,
          })),
      });
      toast.show('Order confirmed and sent to the vendor.', 'success');
      refetch();
    } catch (e) {
      toast.show((e as Error).message, 'error');
    } finally {
      setConfirming(false);
    }
  };

  const sheetItems = useMemo(() => {
    const chosen = new Set(items.map(i => i.menuItemId));
    const q = search.trim().toLowerCase();
    return menu.items
      .filter(i => !chosen.has(i._id))
      .filter(i => !q || i.name.toLowerCase().includes(q));
  }, [menu.items, items, search]);

  /** Confirm every day's breakfast/lunch/dinner for the selected week, using
   *  each meal's aggregated selections as-is. Meals with no selections are skipped. */
  const handleConfirmWeek = async () => {
    const days = weekDays(wkStart);
    const combos = days.flatMap(d => MEAL_TYPES.map(m => ({ date: d, meal: m })));
    setWeekConfirming(true);
    setWeekProgress('');
    let confirmed = 0;
    let skipped = 0;
    let done = 0;
    try {
      for (const { date: d, meal: m } of combos) {
        const res = await gqlRequest<{ aggregatedOrder: { items: EditableItem[] } | null }>(
          AGGREGATED_ORDER,
          { date: d, mealType: m },
        );
        const aggItems = res.aggregatedOrder?.items ?? [];
        if (aggItems.length === 0) {
          skipped++;
        } else {
          await gqlRequest(CONFIRM_ORDER_WITH_ITEMS, {
            date: d,
            mealType: m,
            items: aggItems.map(i => ({
              menuItemId: i.menuItemId,
              name: i.name,
              unit: i.unit,
              quantity: i.quantity,
            })),
          });
          confirmed++;
        }
        done++;
        setWeekProgress(`Processing ${done}/${combos.length}…`);
      }
      toast.show(
        confirmed > 0
          ? `Confirmed ${confirmed} meal${confirmed === 1 ? '' : 's'} for the week (${skipped} had no selections).`
          : 'No selections found for any meal this week.',
        confirmed > 0 ? 'success' : 'info',
      );
      refetch();
    } catch (e) {
      toast.show((e as Error).message, 'error');
    } finally {
      setWeekConfirming(false);
      setWeekProgress('');
    }
  };

  return (
    <Screen
      title="Combine orders"
      headerRight={<SignOutButton />}
      refreshing={loading}
      onRefresh={refetch}>
      {/* Confirm the whole week at once */}
      <Card title="Confirm the whole week">
        <Text style={styles.weekHint}>
          Confirm every day's breakfast, lunch and dinner for a week at once, using what people
          selected. Meals with no selections are skipped.
        </Text>
        <View style={styles.weekNav}>
          <Pressable
            style={styles.navBtn}
            onPress={() => setWkStart(addDays(wkStart, -7))}
            hitSlop={8}>
            <Text style={styles.navBtnText}>‹</Text>
          </Pressable>
          <View style={styles.dateLabelWrap}>
            <Text style={styles.dateLabel}>
              {formatShort(wkStart)} – {formatShort(addDays(wkStart, 6))}
            </Text>
            {weekProgress ? (
              <Text style={styles.todayLink}>{weekProgress}</Text>
            ) : (
              <Text style={styles.todayBadge}>Mon–Sun</Text>
            )}
            <Text style={styles.weekExpense}>
              Week expense: {weeklyExpenseLoading ? '…' : `₹${weeklyExpense.toFixed(2).replace(/\.00$/, '')}`}
            </Text>
          </View>
          <Pressable
            style={styles.navBtn}
            onPress={() => setWkStart(addDays(wkStart, 7))}
            hitSlop={8}>
            <Text style={styles.navBtnText}>›</Text>
          </Pressable>
        </View>
        <Button
          title="Confirm all meals for the week"
          icon="✓"
          onPress={handleConfirmWeek}
          loading={weekConfirming}
          fullWidth
        />
      </Card>

      <SectionLabel>Or review &amp; edit a single meal</SectionLabel>

      {/* Date nav */}
      <View style={styles.dateNav}>
        <Pressable
          style={styles.navBtn}
          onPress={() => setDate(addDays(date, -1))}
          hitSlop={8}>
          <Text style={styles.navBtnText}>‹</Text>
        </Pressable>
        <View style={styles.dateLabelWrap}>
          <Text style={styles.dateLabel}>{formatShort(date)}</Text>
          {!isToday(date) ? (
            <Text style={styles.todayLink} onPress={() => setDate(todayISO())}>
              Jump to today
            </Text>
          ) : (
            <Text style={styles.todayBadge}>Today</Text>
          )}
        </View>
        <Pressable
          style={styles.navBtn}
          onPress={() => setDate(addDays(date, 1))}
          hitSlop={8}>
          <Text style={styles.navBtnText}>›</Text>
        </Pressable>
      </View>

      <Segmented
        value={meal}
        onChange={setMeal}
        options={MEAL_TYPES.map(m => ({
          value: m,
          label: mealMeta[m].label,
          icon: mealMeta[m].icon,
        }))}
      />

      {loading && items.length === 0 ? (
        <Loader label="Aggregating selections…" />
      ) : items.length === 0 ? (
        <EmptyState
          icon="📋"
          title="No selections yet"
          message="No one has picked this meal. You can still add items manually before confirming."
        />
      ) : (
        <Card padded={false}>
          {items.map((item, idx) => {
            const isOpen = expanded.has(item.menuItemId);
            return (
              <View
                key={item.menuItemId}
                style={[styles.itemBlock, idx > 0 && styles.itemBorder]}>
                <View style={styles.itemRow}>
                  <Pressable
                    style={styles.flex1}
                    onPress={() => toggle(item.menuItemId)}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemMeta}>
                      per {item.unit}
                      {item.personBreakdown.length > 0
                        ? ` · ${item.personBreakdown.length} ${
                            item.personBreakdown.length === 1
                              ? 'person'
                              : 'people'
                          } ${isOpen ? '▴' : '▾'}`
                        : ''}
                    </Text>
                  </Pressable>
                  <Stepper
                    value={item.quantity}
                    onChange={v => setQty(item.menuItemId, v)}
                  />
                  <Pressable
                    onPress={() => remove(item.menuItemId)}
                    hitSlop={8}
                    style={styles.removeBtn}>
                    <Text style={styles.removeText}>✕</Text>
                  </Pressable>
                </View>
                {isOpen && item.personBreakdown.length > 0 ? (
                  <View style={styles.breakdown}>
                    {item.personBreakdown.map(pb => (
                      <View key={pb.userId} style={styles.breakdownRow}>
                        <Text style={styles.breakdownName}>{pb.userName}</Text>
                        <Text style={styles.breakdownQty}>
                          {pb.quantity} {item.unit}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </Card>
      )}

      {/* Eating status */}
      {items.length > 0 && (
        <Card title="Eating status">
          {(() => {
            const allPersonIds = new Set<string>();
            const allPersonNames = new Map<string, string>();
            items.forEach(item => {
              item.personBreakdown.forEach(pb => {
                allPersonIds.add(pb.userId);
                allPersonNames.set(pb.userId, pb.userName);
              });
            });
            const doneIds = new Set(doneUsers.map(d => d.userId));
            const eaten = Array.from(allPersonIds).filter(id => doneIds.has(id));
            const notEaten = Array.from(allPersonIds).filter(id => !doneIds.has(id));
            if (allPersonIds.size === 0) {
              return <Text style={styles.itemMeta}>No person selections for this meal.</Text>;
            }
            return (
              <View>
                <View style={styles.eatingStatusRow}>
                  <Text style={styles.eatingLabel}>
                    Eaten ({eaten.length}/{allPersonIds.size})
                  </Text>
                  {eaten.length === 0 ? (
                    <Text style={styles.eatingEmpty}>None yet</Text>
                  ) : (
                    eaten.map(id => (
                      <View key={id} style={styles.eatingChip}>
                        <Text style={styles.eatingChipDone}>✓ {allPersonNames.get(id)}</Text>
                      </View>
                    ))
                  )}
                </View>
                <View style={[styles.eatingStatusRow, { marginTop: spacing.sm }]}>
                  <Text style={styles.eatingLabel}>
                    Not eaten ({notEaten.length}/{allPersonIds.size})
                  </Text>
                  {notEaten.length === 0 ? (
                    <Text style={styles.eatingEmpty}>Everyone has eaten</Text>
                  ) : (
                    notEaten.map(id => (
                      <View key={id} style={styles.eatingChipPending}>
                        <Text style={styles.eatingChipPendingText}>○ {allPersonNames.get(id)}</Text>
                      </View>
                    ))
                  )}
                </View>
              </View>
            );
          })()}
        </Card>
      )}

      <Button
        title="Add item"
        icon="＋"
        variant="outline"
        fullWidth
        onPress={() => {
          setSearch('');
          setSheetOpen(true);
        }}
      />

      <Button
        title="Confirm & send to vendor"
        icon="✓"
        onPress={confirm}
        loading={confirming}
        disabled={items.length === 0}
        fullWidth
        size="lg"
      />

      <Sheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={`Add ${mealMeta[meal].label} item`}>
        <Input
          placeholder="Search items…"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
        {sheetItems.length === 0 ? (
          <EmptyState icon="🔎" title="No items" />
        ) : (
          <View style={styles.sheetList}>
            <SectionLabel>Tap to add</SectionLabel>
            {sheetItems.map(i => (
              <Pressable
                key={i._id}
                style={styles.sheetItem}
                onPress={() => addItem(i._id, i.name, i.unit)}>
                <View style={styles.flex1}>
                  <Text style={styles.itemName}>{i.name}</Text>
                  <Text style={styles.itemMeta}>per {i.unit}</Text>
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
  weekHint: {
    color: colors.textMuted,
    fontSize: font.small,
    lineHeight: 19,
    marginBottom: spacing.md,
  },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  dateNav: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
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
  dateLabelWrap: { flex: 1, alignItems: 'center' },
  dateLabel: { color: colors.text, fontSize: font.body, fontWeight: '700' },
  todayLink: { color: colors.primary, fontSize: font.tiny, marginTop: 2 },
  todayBadge: { color: colors.textFaint, fontSize: font.tiny, marginTop: 2 },
  weekExpense: { color: colors.primary, fontSize: font.small, fontWeight: '700', marginTop: 2 },

  itemBlock: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  itemBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  itemName: { color: colors.text, fontSize: font.body, fontWeight: '600' },
  itemMeta: { color: colors.textFaint, fontSize: font.tiny, marginTop: 2 },
  removeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: colors.danger, fontSize: 13, fontWeight: '700' },
  breakdown: {
    marginTop: spacing.md,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  breakdownName: { color: colors.textMuted, fontSize: font.small },
  breakdownQty: { color: colors.text, fontSize: font.small, fontWeight: '600' },

  eatingStatusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
  eatingLabel: {
    color: colors.text,
    fontSize: font.small,
    fontWeight: '700',
    width: '100%',
    marginBottom: 2,
  },
  eatingEmpty: {
    color: colors.textFaint,
    fontSize: font.tiny,
    fontStyle: 'italic',
  },
  eatingChip: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  eatingChipDone: {
    color: colors.success,
    fontSize: font.tiny,
    fontWeight: '700',
  },
  eatingChipPending: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  eatingChipPendingText: {
    color: colors.textMuted,
    fontSize: font.tiny,
    fontWeight: '600',
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
