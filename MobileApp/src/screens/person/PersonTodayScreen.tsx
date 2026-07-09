import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../../ui/Screen';
import { Button, Card, EmptyState, Loader } from '../../ui';
import { SignOutButton } from '../../ui/SignOutButton';
import { useMenuItems, useMySelectionsForWeek, useMyMealDoneForWeek, useMealDoneStatus } from '../../api/hooks';
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
  const doneStatus = {
    breakfast: useMealDoneStatus(today, 'breakfast'),
    lunch: useMealDoneStatus(today, 'lunch'),
    dinner: useMealDoneStatus(today, 'dinner'),
  };
  const [localDone, setLocalDone] = useState<Set<string>>(new Set());

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
    MEAL_TYPES.forEach(m => doneStatus[m].refetch());
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

  // Saturday (6) or Sunday (0) — nudge the user to plan the upcoming week.
  const isWeekend = (() => {
    const [y, m, d] = today.split('-').map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    return dow === 0 || dow === 6;
  })();

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
          {isWeekend && (
            <Card padded={false} style={styles.reminderCard}>
              <View style={styles.reminderRow}>
                <Text style={styles.reminderIcon}>🗓️</Text>
                <View style={styles.reminderTextWrap}>
                  <Text style={styles.reminderTitle}>It's the weekend — plan next week!</Text>
                  <Text style={styles.reminderBody}>
                    Open “Plan my week”, move to next week, and tap “Import from last week” to set your meals.
                  </Text>
                </View>
              </View>
              <Button
                title="Plan next week"
                icon="🗓️"
                onPress={() => nav.navigate('Week')}
                fullWidth
                style={{ marginTop: spacing.sm }}
              />
            </Card>
          )}
          {MEAL_TYPES.map(meal => {
            const rows = todayByMeal[meal];
            const meta = mealMeta[meal];
            const eaters = doneStatus[meal].doneUsers;
            return (
              <Card key={meal} padded={false}>
                <View style={styles.mealHeader}>
                  <Text style={styles.mealIcon}>{meta.icon}</Text>
                  <Text style={styles.mealTitle}>{meta.label}</Text>
                  <Pressable onPress={() => handleMarkDone(meal)}>
                    <Text style={styles.doneEmoji}>
                      {isMealDone(meal) ? '😋' : '🍔'}
                    </Text>
                  </Pressable>
                </View>
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
                {eaters.length > 0 ? (
                  <View style={styles.eatenRow}>
                    <Text style={styles.eatenText}>
                      😋 Eaten by: {eaters.map(u => u.userName).join(', ')}
                    </Text>
                  </View>
                ) : null}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  reminderCard: {
    borderColor: colors.warning,
    backgroundColor: 'rgba(245,158,11,0.10)',
    padding: spacing.lg,
  },
  reminderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  reminderIcon: { fontSize: 22 },
  reminderTextWrap: { flex: 1 },
  reminderTitle: { color: colors.text, fontSize: font.body, fontWeight: '700', marginBottom: 2 },
  reminderBody: { color: colors.textMuted, fontSize: font.small },
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
  eatenRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  eatenText: { color: colors.textMuted, fontSize: font.small },
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
