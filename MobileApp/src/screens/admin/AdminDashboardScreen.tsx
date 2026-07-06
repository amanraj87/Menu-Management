import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Screen } from '../../ui/Screen';
import { Badge, Card, Loader } from '../../ui';
import { SignOutButton } from '../../ui/SignOutButton';
import { gqlRequest } from '../../api/client';
import { CONFIRMED_ORDERS } from '../../api/operations';
import { useMenuItems, useUsers } from '../../api/hooks';
import { useFeedbacksForAdmin } from '../../api/hooks';
import { colors, font, mealMeta, radius, spacing } from '../../theme';
import { formatLong, todayISO, weekDays, weekStart } from '../../utils/date';
import type { ConfirmedOrder } from '../../types';

function orderCost(
  orders: ConfirmedOrder[],
  priceMap: Map<string, number>,
): { total: number; perPerson: Map<string, number> } {
  let total = 0;
  const perPerson = new Map<string, number>();
  orders.forEach(o =>
    o.items.forEach(it => {
      const price = priceMap.get(it.menuItemId) ?? 0;
      total += price * it.quantity;
      it.personBreakdown?.forEach(pb => {
        perPerson.set(
          pb.userId,
          (perPerson.get(pb.userId) ?? 0) + price * pb.quantity,
        );
      });
    }),
  );
  return { total, perPerson };
}

export function AdminDashboardScreen() {
  const nav = useNavigation<any>();
  const today = todayISO();
  const { users } = useUsers();
  const { feedbacks } = useFeedbacksForAdmin();
  const menu = useMenuItems();

  const [todayOrders, setTodayOrders] = useState<ConfirmedOrder[]>([]);
  const [weekOrders, setWeekOrders] = useState<ConfirmedOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const priceMap = useMemo(() => {
    const m = new Map<string, number>();
    menu.items.forEach(i => m.set(i._id, i.pricePerUnit ?? 0));
    return m;
  }, [menu.items]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const days = weekDays(weekStart(today));
      const results = await Promise.all(
        days.map(d =>
          gqlRequest<{ confirmedOrders: any[] }>(CONFIRMED_ORDERS, { date: d }),
        ),
      );
      const all: ConfirmedOrder[] = results.flatMap(r =>
        (r.confirmedOrders ?? []).map(o => ({ ...o, _id: o.id })),
      );
      setWeekOrders(all);
      setTodayOrders(all.filter(o => o.date === today));
    } catch {
      // errors surface as empty state
    } finally {
      setLoading(false);
    }
  }, [today]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const todayCost = useMemo(
    () => orderCost(todayOrders, priceMap),
    [todayOrders, priceMap],
  );
  const weekCost = useMemo(
    () => orderCost(weekOrders, priceMap),
    [weekOrders, priceMap],
  );

  const roleCounts = useMemo(() => {
    const c = { person: 0, admin: 0, vendor: 0 };
    users.forEach(u => {
      c[u.role]++;
    });
    return c;
  }, [users]);

  const pending = feedbacks.filter(f => f.status === 'pending').length;
  const weekAvg =
    weekCost.perPerson.size > 0
      ? weekCost.total / weekCost.perPerson.size
      : 0;

  return (
    <Screen
      title="Dashboard"
      subtitle={formatLong(today)}
      headerRight={<SignOutButton />}
      refreshing={loading}
      onRefresh={load}>
      {loading && weekOrders.length === 0 ? (
        <Loader label="Crunching numbers…" />
      ) : (
        <>
          {/* Today */}
          <View style={styles.statRow}>
            <Card style={styles.statCard}>
              <Text style={styles.statValue}>{todayOrders.length}</Text>
              <Text style={styles.statLabel}>Confirmed meals today</Text>
            </Card>
            <Card style={styles.statCard}>
              <Text style={styles.statValue}>₹{Math.round(todayCost.total)}</Text>
              <Text style={styles.statLabel}>Today's spend</Text>
            </Card>
          </View>

          {/* This week expenses */}
          <Card title="This week" subtitle="Monday to Sunday">
            <View style={styles.bigMoneyRow}>
              <View>
                <Text style={styles.bigMoney}>₹{Math.round(weekCost.total)}</Text>
                <Text style={styles.statLabel}>Total confirmed spend</Text>
              </View>
              <View style={styles.avgPill}>
                <Text style={styles.avgValue}>₹{Math.round(weekAvg)}</Text>
                <Text style={styles.avgLabel}>avg / person</Text>
              </View>
            </View>
          </Card>

          {/* Meals breakdown for today */}
          <Card title="Today's confirmed orders" padded={false}>
            {todayOrders.length === 0 ? (
              <Text style={styles.emptyRow}>No orders confirmed yet today.</Text>
            ) : (
              todayOrders
                .slice()
                .sort((a, b) => a.mealType.localeCompare(b.mealType))
                .map(o => (
                  <View key={o._id} style={styles.mealLine}>
                    <Text style={styles.mealLineIcon}>
                      {mealMeta[o.mealType].icon}
                    </Text>
                    <Text style={styles.mealLineLabel}>
                      {mealMeta[o.mealType].label}
                    </Text>
                    <Text style={styles.mealLineCount}>
                      {o.items.length} item{o.items.length === 1 ? '' : 's'}
                    </Text>
                  </View>
                ))
            )}
          </Card>

          {/* Team summary */}
          <Card title="Team">
            <View style={styles.summaryRow}>
              <SummaryStat label="Members" value={users.length} />
              <SummaryStat label="People" value={roleCounts.person} />
              <SummaryStat label="Vendors" value={roleCounts.vendor} />
            </View>
            <View style={styles.divider} />
            <View style={styles.feedbackRow}>
              <Text style={styles.feedbackText}>Pending feedback</Text>
              <View style={styles.feedbackRight}>
                {pending > 0 ? (
                  <Badge label={`${pending} to review`} tone="warning" />
                ) : (
                  <Badge label="All clear" tone="primary" />
                )}
                <Text
                  style={styles.link}
                  onPress={() => nav.navigate('Feedback')}>
                  Review →
                </Text>
              </View>
            </View>
          </Card>
        </>
      )}
    </Screen>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.summaryStat}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statRow: { flexDirection: 'row', gap: spacing.md },
  statCard: { flex: 1, padding: spacing.lg },
  statValue: { color: colors.primary, fontSize: 28, fontWeight: '900' },
  statLabel: { color: colors.textMuted, fontSize: font.small, marginTop: 4 },

  bigMoneyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bigMoney: { color: colors.text, fontSize: 30, fontWeight: '900' },
  avgPill: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  avgValue: { color: colors.primary, fontSize: font.h3, fontWeight: '800' },
  avgLabel: { color: colors.primary, fontSize: font.tiny, marginTop: 2 },

  emptyRow: {
    color: colors.textFaint,
    fontStyle: 'italic',
    padding: spacing.lg,
    fontSize: font.small,
  },
  mealLine: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  mealLineIcon: { fontSize: 16, marginRight: spacing.sm },
  mealLineLabel: { color: colors.text, fontSize: font.body, flex: 1, fontWeight: '600' },
  mealLineCount: { color: colors.textMuted, fontSize: font.small },

  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryStat: { alignItems: 'center', flex: 1 },
  summaryValue: { color: colors.text, fontSize: font.h2, fontWeight: '800' },
  summaryLabel: { color: colors.textMuted, fontSize: font.small, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.lg },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  feedbackText: { color: colors.text, fontSize: font.body },
  feedbackRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  link: { color: colors.primary, fontSize: font.small, fontWeight: '700' },
});
