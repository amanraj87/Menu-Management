import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../ui/Screen';
import { Card, EmptyState, Loader } from '../../ui';
import { SignOutButton } from '../../ui/SignOutButton';
import { useConfirmedOrders } from '../../api/hooks';
import { colors, font, mealMeta, radius, spacing } from '../../theme';
import { formatLong, todayISO } from '../../utils/date';
import { MEAL_TYPES, type MealType } from '../../types';

export function VendorTodayScreen() {
  const today = todayISO();
  const { orders, loading, refetch } = useConfirmedOrders(today);

  const byMeal = useMemo(() => {
    const map: Record<MealType, typeof orders> = {
      breakfast: [],
      lunch: [],
      dinner: [],
    };
    orders.forEach(o => map[o.mealType].push(o));
    return map;
  }, [orders]);

  const total = orders.reduce((n, o) => n + o.items.length, 0);

  return (
    <Screen
      title={"Shef's Kitchen👨‍🍳"}
      subtitle={formatLong(today)}
      headerRight={<SignOutButton />}
      refreshing={loading}
      onRefresh={refetch}>
      {loading && orders.length === 0 ? (
        <Loader label="Loading today's orders…" />
      ) : (
        <>
          <Card style={styles.hero}>
            <Text style={styles.heroValue}>{total}</Text>
            <Text style={styles.heroLabel}>items to prepare today</Text>
          </Card>

          {MEAL_TYPES.map(meal => {
            const meta = mealMeta[meal];
            const items = byMeal[meal].flatMap(o => o.items);
            return (
              <Card key={meal} padded={false}>
                <View style={styles.mealHeader}>
                  <Text style={styles.mealIcon}>{meta.icon}</Text>
                  <Text style={styles.mealTitle}>{meta.label}</Text>
                  <View style={[styles.dot, { backgroundColor: meta.accent }]} />
                </View>
                {items.length === 0 ? (
                  <Text style={styles.emptyRow}>No order confirmed yet</Text>
                ) : (
                  items.map((it, i) => (
                    <View key={`${it.menuItemId}-${i}`} style={styles.itemRow}>
                      <Text style={styles.itemName}>{it.name}</Text>
                      <Text style={styles.itemQty}>
                        {it.quantity} {it.unit}
                      </Text>
                    </View>
                  ))
                )}
              </Card>
            );
          })}

          {total === 0 ? (
            <EmptyState
              icon="🍳"
              title="Nothing confirmed yet"
              message="Once the admin confirms orders, they'll appear here."
            />
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: spacing.xl },
  heroValue: { color: colors.primary, fontSize: 44, fontWeight: '900' },
  heroLabel: { color: colors.textMuted, fontSize: font.body, marginTop: 4 },
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
    fontStyle: 'italic',
    fontSize: font.small,
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
