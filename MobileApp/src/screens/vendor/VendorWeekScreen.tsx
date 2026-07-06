import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../ui/Screen';
import { Card, EmptyState, Loader } from '../../ui';
import { SignOutButton } from '../../ui/SignOutButton';
import { gqlRequest } from '../../api/client';
import { CONFIRMED_ORDERS } from '../../api/operations';
import { colors, font, mealMeta, spacing } from '../../theme';
import { addDays, formatShort, isToday, todayISO } from '../../utils/date';
import { MEAL_TYPES, type ConfirmedOrder, type MealType } from '../../types';

export function VendorWeekScreen() {
  const [ordersByDate, setOrdersByDate] = useState<
    Record<string, ConfirmedOrder[]>
  >({});
  const [loading, setLoading] = useState(true);

  const days = Array.from({ length: 7 }, (_, i) => addDays(todayISO(), i));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.all(
        days.map(d =>
          gqlRequest<{ confirmedOrders: any[] }>(CONFIRMED_ORDERS, {
            date: d,
          }).then(r => ({
            date: d,
            orders: (r.confirmedOrders ?? []).map(o => ({ ...o, _id: o.id })),
          })),
        ),
      );
      const map: Record<string, ConfirmedOrder[]> = {};
      results.forEach(r => {
        map[r.date] = r.orders;
      });
      setOrdersByDate(map);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const grandTotal = Object.values(ordersByDate)
    .flat()
    .reduce((n, o) => n + o.items.length, 0);

  return (
    <Screen
      title="Week ahead"
      subtitle="Confirmed orders for the next 7 days"
      headerRight={<SignOutButton />}
      refreshing={loading}
      onRefresh={load}>
      {loading && Object.keys(ordersByDate).length === 0 ? (
        <Loader label="Loading week…" />
      ) : grandTotal === 0 ? (
        <EmptyState
          icon="🗓️"
          title="No confirmed orders"
          message="Confirmed orders for the coming week will appear here."
        />
      ) : (
        days.map(date => {
          const orders = ordersByDate[date] ?? [];
          const byMeal: Record<MealType, ConfirmedOrder[]> = {
            breakfast: [],
            lunch: [],
            dinner: [],
          };
          orders.forEach(o => byMeal[o.mealType].push(o));
          const dayTotal = orders.reduce((n, o) => n + o.items.length, 0);

          return (
            <Card
              key={date}
              title={formatShort(date)}
              subtitle={isToday(date) ? 'Today' : undefined}
              padded={false}
              right={
                dayTotal > 0 ? (
                  <View style={styles.countPill}>
                    <Text style={styles.countText}>{dayTotal}</Text>
                  </View>
                ) : undefined
              }>
              <View style={styles.body}>
                {dayTotal === 0 ? (
                  <Text style={styles.emptyRow}>No orders</Text>
                ) : (
                  MEAL_TYPES.map(meal => {
                    const items = byMeal[meal].flatMap(o => o.items);
                    if (items.length === 0) return null;
                    return (
                      <View key={meal} style={styles.mealGroup}>
                        <Text style={styles.mealLabel}>
                          {mealMeta[meal].icon} {mealMeta[meal].label}
                        </Text>
                        {items.map((it, i) => (
                          <View key={`${it.menuItemId}-${i}`} style={styles.itemRow}>
                            <Text style={styles.itemName}>{it.name}</Text>
                            <Text style={styles.itemQty}>
                              {it.quantity} {it.unit}
                            </Text>
                          </View>
                        ))}
                      </View>
                    );
                  })
                )}
              </View>
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  countPill: {
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    minWidth: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  countText: { color: colors.primary, fontWeight: '800', fontSize: font.small },
  emptyRow: {
    color: colors.textFaint,
    fontStyle: 'italic',
    fontSize: font.small,
  },
  mealGroup: { marginTop: spacing.md },
  mealLabel: {
    color: colors.textMuted,
    fontSize: font.small,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  itemName: { color: colors.text, fontSize: font.body, flex: 1 },
  itemQty: { color: colors.primary, fontSize: font.small, fontWeight: '700' },
});
