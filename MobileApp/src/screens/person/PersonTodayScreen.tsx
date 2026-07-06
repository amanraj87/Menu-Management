import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../../ui/Screen';
import { Button, Card, EmptyState, Loader } from '../../ui';
import { SignOutButton } from '../../ui/SignOutButton';
import { useMenuItems, useMySelectionsForWeek } from '../../api/hooks';
import { useSession } from '../../context/SessionContext';
import { colors, font, mealMeta, radius, spacing } from '../../theme';
import { formatLong, todayISO, weekStart } from '../../utils/date';
import { MEAL_TYPES, type MealType } from '../../types';

export function PersonTodayScreen() {
  const nav = useNavigation<any>();
  const { session } = useSession();
  const today = todayISO();
  const start = weekStart(today);

  const menu = useMenuItems();
  const sel = useMySelectionsForWeek(start);

  const loading = menu.loading || sel.loading;
  const refetch = () => {
    menu.refetch();
    sel.refetch();
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
            return (
              <Card key={meal} padded={false}>
                <View style={styles.mealHeader}>
                  <Text style={styles.mealIcon}>{meta.icon}</Text>
                  <Text style={styles.mealTitle}>{meta.label}</Text>
                  <View style={[styles.dot, { backgroundColor: meta.accent }]} />
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
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  mealIcon: { fontSize: 18, marginRight: spacing.sm },
  mealTitle: { color: colors.text, fontSize: font.h3, fontWeight: '700', flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
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
