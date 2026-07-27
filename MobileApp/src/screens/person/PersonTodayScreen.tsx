import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../../ui/Screen';
import { Button, Card, EmptyState, Loader } from '../../ui';
import { Sheet } from '../../ui/Sheet';
import { SignOutButton } from '../../ui/SignOutButton';
import { useMenuItems, useMySelectionsForWeek, useMyMealDoneForWeek, useMealDoneStatus, useAggregatedOrder, useMealCancellationsForRange } from '../../api/hooks';
import { gqlRequest } from '../../api/client';
import { MARK_MEAL_DONE } from '../../api/operations';
import { useSession } from '../../context/SessionContext';
import { useToast } from '../../context/ToastContext';
import { colors, font, mealMeta, radius, spacing } from '../../theme';
import { formatLong, todayISO, weekStart } from '../../utils/date';
import { MEAL_TYPES, type MealType } from '../../types';

export function PersonTodayScreen() {
  const nav = useNavigation<any>();
  const { session } = useSession();
  const toast = useToast();
  const today = todayISO();
  const start = weekStart(today);

  const menu = useMenuItems();
  const sel = useMySelectionsForWeek(start);
  const doneQuery = useMyMealDoneForWeek(start);
  const cancel = useMealCancellationsForRange(today, today);
  const isMealCancelled = (meal: MealType) => cancel.cancellations.some(c => c.date === today && c.mealType === meal);
  const doneStatus = {
    breakfast: useMealDoneStatus(today, 'breakfast'),
    lunch: useMealDoneStatus(today, 'lunch'),
    dinner: useMealDoneStatus(today, 'dinner'),
  };
  // Attendance uses the LIVE aggregated selections (same source as each user's
  // own "today" list) so the dishes shown here match the today page. Confirmed
  // orders are a snapshot from "Send to Shefs" and can lag current selections.
  const agg = {
    breakfast: useAggregatedOrder(today, 'breakfast'),
    lunch: useAggregatedOrder(today, 'lunch'),
    dinner: useAggregatedOrder(today, 'dinner'),
  };
  const [localDone, setLocalDone] = useState<Set<string>>(new Set());
  const [attendanceMeal, setAttendanceMeal] = useState<MealType | null>(null);

  /** Everyone who ordered a given meal today (from the live aggregated selections). */
  const rosterFor = (meal: MealType): Array<{ userId: string; userName: string }> => {
    const map = new Map<string, string>();
    agg[meal].aggregated.items.forEach(it =>
      it.personBreakdown.forEach(p => map.set(p.userId, p.userName)),
    );
    doneStatus[meal].doneUsers.forEach(u => map.set(u.userId, u.userName));
    return Array.from(map, ([userId, userName]) => ({ userId, userName }));
  };

  const dishesByUserFor = (meal: MealType): Map<string, Array<{ name: string; quantity: number }>> => {
    const map = new Map<string, Array<{ name: string; quantity: number }>>();
    agg[meal].aggregated.items.forEach(it =>
      it.personBreakdown.forEach(p => {
        if (!map.has(p.userId)) map.set(p.userId, []);
        map.get(p.userId)!.push({ name: it.name, quantity: p.quantity });
      }),
    );
    return map;
  };

  const attendanceFor = (meal: MealType) => {
    const eatenIds = new Set(doneStatus[meal].doneUsers.map(u => u.userId));
    const roster = rosterFor(meal);
    const eaten = roster.filter(p => eatenIds.has(p.userId)).sort((a, b) => a.userName.localeCompare(b.userName));
    const notEaten = roster.filter(p => !eatenIds.has(p.userId)).sort((a, b) => a.userName.localeCompare(b.userName));
    return { eaten, notEaten, total: roster.length };
  };

  useEffect(() => {
    const next = new Set<string>();
    doneQuery.doneList.forEach(d => next.add(`${d.date}|${d.mealType}`));
    setLocalDone(next);
  }, [JSON.stringify(doneQuery.doneList)]);

  const isMealDone = (meal: MealType) => localDone.has(`${today}|${meal}`);

  const handleMarkDone = async (meal: MealType) => {
    const k = `${today}|${meal}`;
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
        date: today,
        mealType: meal,
        done: newDone,
      });
      doneStatus[meal].refetch();
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

  const loading = menu.loading || sel.loading;
  const refetch = () => {
    menu.refetch();
    sel.refetch();
    doneQuery.refetch();
    cancel.refetch();
    MEAL_TYPES.forEach(m => {
      doneStatus[m].refetch();
      agg[m].refetch();
    });
  };

  const itemMap = useMemo(() => {
    const m = new Map<string, { name: string; unit: string }>();
    menu.items.forEach(i => m.set(i._id, { name: i.name, unit: i.unit }));
    return m;
  }, [menu.items]);

  const todayByMeal = useMemo(() => {
    const out: Record<MealType, { name: string; unit: string; quantity: number }[]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
    };
    sel.selections
      .filter(s => s.date === today)
      .forEach(s => {
        s.items.forEach(it => {
          const info = itemMap.get(it.menuItemId);
          out[s.mealType].push({
            name: info?.name ?? 'Item',
            unit: info?.unit ?? '',
            quantity: it.quantity,
          });
        });
      });
    return out;
  }, [sel.selections, itemMap, today]);

  const totalItems = MEAL_TYPES.reduce(
    (n, m) => n + todayByMeal[m].length,
    0,
  );

  return (
    <Screen
      title={`Hi, ${session?.name?.split(' ')[0] ?? 'there'} 👋`}
      subtitle={formatLong(today)}
      headerRight={<SignOutButton />}
      refreshing={loading}
      onRefresh={refetch}>
      {loading && !menu.items.length ? (
        <Loader label="Loading today's meals…" />
      ) : (
        <>
          {MEAL_TYPES.map(meal => {
            const rows = todayByMeal[meal];
            const meta = mealMeta[meal];
            const cancelled = isMealCancelled(meal);
            const att = attendanceFor(meal);
            return (
              <Card key={meal} padded={false}>
                <View style={styles.mealHeader}>
                  <Text style={styles.mealIcon}>{meta.icon}</Text>
                  <Text style={[styles.mealTitle, cancelled && styles.mealTitleCancelled]}>{meta.label}</Text>
                  {!cancelled && (
                    <Pressable onPress={() => handleMarkDone(meal)}>
                      <Text style={styles.doneEmoji}>
                        {isMealDone(meal) ? '😋' : '🍔'}
                      </Text>
                    </Pressable>
                  )}
                </View>
                {cancelled ? (
                  <View style={styles.cancelledCard}>
                    <Text style={styles.cancelledEmoji}>👨‍🍳</Text>
                    <Text style={styles.cancelledNote}>Cancelled — kitchen closed</Text>
                  </View>
                ) : (
                  <>
                    {rows.length === 0 ? (
                      <Text style={styles.emptyRow}>No items selected</Text>
                    ) : (
                      rows.map((r, i) => (
                        <View key={i} style={styles.itemRow}>
                          <Text style={styles.itemName}>{r.name}</Text>
                          <Text style={styles.itemQty}>
                            {r.quantity} {r.unit}
                          </Text>
                        </View>
                      ))
                    )}
                    <Pressable style={styles.whoRow} onPress={() => setAttendanceMeal(meal)}>
                      <Text style={styles.whoChipText}>😋 {att.eaten.length}</Text>
                      <Text style={styles.whoChipDot}>·</Text>
                      <Text style={styles.whoChipText}>🤤 {att.notEaten.length}</Text>
                      <Text style={styles.whoRowChevron}>›</Text>
                    </Pressable>
                  </>
                )}
              </Card>
            );
          })}

          {totalItems === 0 ? (
            <EmptyState
              icon="🗓️"
              title="Nothing planned for today"
              message="Plan your week to pick meals ahead of time."
            />
          ) : null}

          <Button
            title="Plan my week"
            icon="🗓️"
            variant="outline"
            fullWidth
            onPress={() => nav.navigate('Week')}
          />
        </>
      )}

      <Sheet
        visible={attendanceMeal !== null}
        onClose={() => setAttendanceMeal(null)}
        maxHeightPct={80}
        title={attendanceMeal ? `${mealMeta[attendanceMeal].label} — who's eaten?` : ''}>
        {attendanceMeal && (() => {
          const att = attendanceFor(attendanceMeal);
          const dishes = dishesByUserFor(attendanceMeal);
          const renderPerson = (p: { userId: string; userName: string }, emoji: string) => {
            const ds = dishes.get(p.userId) ?? [];
            return (
              <View key={p.userId} style={styles.attendanceRow}>
                <Text style={styles.attendanceEmoji}>{emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.attendanceName}>{p.userName}</Text>
                  {ds.length > 0 && (
                    <Text style={styles.attendanceDishes} numberOfLines={2}>
                      {ds.map(d => `${d.name}${d.quantity !== 1 ? ` ×${d.quantity}` : ''}`).join(', ')}
                    </Text>
                  )}
                </View>
              </View>
            );
          };
          return (
            <View>
              <View style={[styles.attBanner, styles.attBannerEaten]}>
                <Text style={[styles.attBannerText, styles.attBannerTextEaten]}>😋 Eaten</Text>
                <Text style={[styles.attBannerText, styles.attBannerTextEaten]}>{att.eaten.length}</Text>
              </View>
              {att.eaten.length === 0 ? (
                <Text style={styles.attendanceEmpty}>No one has eaten yet.</Text>
              ) : (
                att.eaten.map(p => renderPerson(p, '😋'))
              )}
              <View style={{ height: spacing.lg }} />
              <View style={[styles.attBanner, styles.attBannerNotYet]}>
                <Text style={[styles.attBannerText, styles.attBannerTextNotYet]}>🤤 Not yet</Text>
                <Text style={[styles.attBannerText, styles.attBannerTextNotYet]}>{att.notEaten.length}</Text>
              </View>
              {att.notEaten.length === 0 ? (
                <Text style={styles.attendanceEmpty}>
                  {att.total === 0 ? 'No orders for this meal today.' : 'Everyone has eaten! 🎉'}
                </Text>
              ) : (
                att.notEaten.map(p => renderPerson(p, '🤤'))
              )}
            </View>
          );
        })()}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  mealIcon: { fontSize: 18, marginRight: spacing.sm },
  mealTitle: { color: colors.text, fontSize: font.h3, fontWeight: '700', flex: 1 },
  doneEmoji: { fontSize: 22 },
  emptyRow: {
    color: colors.textFaint,
    fontSize: font.small,
    fontStyle: 'italic',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  itemName: { color: colors.text, fontSize: font.body, flex: 1 },
  whoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  whoChipText: { color: colors.text, fontSize: font.body, fontWeight: '700' },
  whoChipDot: { color: colors.textFaint, fontSize: font.body },
  whoRowChevron: { color: colors.textFaint, fontSize: font.h3, fontWeight: '700', marginLeft: 'auto' },
  cancelledCard: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  cancelledEmoji: { fontSize: 52, lineHeight: 60 },
  cancelledNote: { color: colors.danger, fontSize: font.small, fontWeight: '700' },
  mealTitleCancelled: { textDecorationLine: 'line-through', color: colors.textFaint },
  attendanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  attendanceEmoji: { fontSize: 16 },
  attendanceName: { color: colors.text, fontSize: font.body, fontWeight: '600' },
  attendanceDishes: { color: colors.textMuted, fontSize: font.tiny, marginTop: 1 },
  attBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  attBannerText: { fontSize: font.body, fontWeight: '800' },
  attBannerEaten: {
    backgroundColor: 'rgba(34,197,94,0.16)',
    borderColor: 'rgba(34,197,94,0.5)',
    shadowColor: '#22c55e',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  attBannerTextEaten: { color: colors.primary },
  attBannerNotYet: {
    backgroundColor: 'rgba(245,158,11,0.16)',
    borderColor: 'rgba(245,158,11,0.5)',
    shadowColor: '#f59e0b',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  attBannerTextNotYet: { color: colors.warning },
  attendanceEmpty: { color: colors.textFaint, fontSize: font.small, fontStyle: 'italic', paddingVertical: spacing.sm },
  itemQty: {
    color: colors.primary,
    fontSize: font.small,
    fontWeight: '700',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
});
