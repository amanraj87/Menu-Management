import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Screen } from '../../ui/Screen';
import { Badge, Button, Card, Loader, SectionLabel } from '../../ui';
import { SignOutButton } from '../../ui/SignOutButton';
import { gqlRequest } from '../../api/client';
import {
  CONFIRMED_ORDERS_FOR_RANGE,
  UPDATE_SETTINGS,
} from '../../api/operations';
import { useMenuItems, useUsers, useSettings } from '../../api/hooks';
import { useFeedbacksForAdmin } from '../../api/hooks';
import { useToast } from '../../context/ToastContext';
import { colors, font, radius, spacing } from '../../theme';
import { formatLong, todayISO, weekStart as getWeekStart, addDays } from '../../utils/date';
import type { ConfirmedOrder } from '../../types';

type Period = 'day' | 'week' | 'month' | 'custom';

function getWeekEnd(ws: string): string {
  return addDays(ws, 6);
}

function getMonthStart(dateStr: string): string {
  return dateStr.slice(0, 8) + '01';
}

function getMonthEnd(dateStr: string): string {
  const year = parseInt(dateStr.slice(0, 4), 10);
  const month = parseInt(dateStr.slice(5, 7), 10);
  const lastDay = new Date(year, month, 0).getDate();
  return `${dateStr.slice(0, 8)}${String(lastDay).padStart(2, '0')}`;
}

function orderCost(
  orders: ConfirmedOrder[],
  priceMap: Map<string, number>,
): { total: number; perPerson: Array<{ userId: string; userName: string; total: number }> } {
  let total = 0;
  const personMap = new Map<string, { userName: string; total: number }>();
  orders.forEach(o =>
    o.items.forEach(it => {
      const price = priceMap.get(it.menuItemId) ?? 0;
      total += price * it.quantity;
      it.personBreakdown?.forEach(pb => {
        const existing = personMap.get(pb.userId);
        const cost = price * pb.quantity;
        if (existing) existing.total += cost;
        else personMap.set(pb.userId, { userName: pb.userName, total: cost });
      });
    }),
  );
  const perPerson = Array.from(personMap.entries())
    .map(([userId, v]) => ({ userId, userName: v.userName, total: v.total }))
    .sort((a, b) => b.total - a.total);
  return { total, perPerson };
}

function computeDishBreakdown(orders: ConfirmedOrder[]): Array<{ name: string; unit: string; quantity: number }> {
  const dishMap = new Map<string, { name: string; unit: string; quantity: number }>();
  for (const order of orders) {
    for (const item of order.items) {
      const existing = dishMap.get(item.menuItemId);
      if (existing) existing.quantity += item.quantity;
      else dishMap.set(item.menuItemId, { name: item.name, unit: item.unit, quantity: item.quantity });
    }
  }
  return Array.from(dishMap.values()).sort((a, b) => b.quantity - a.quantity);
}

function PeriodSelector({
  value,
  onChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
}: {
  value: Period;
  onChange: (p: Period) => void;
  customStart: string;
  customEnd: string;
  onCustomStartChange: (v: string) => void;
  onCustomEndChange: (v: string) => void;
}) {
  const pills: { key: Period; label: string }[] = [
    { key: 'day', label: 'Day' },
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
    { key: 'custom', label: 'Custom' },
  ];
  return (
    <View style={ps.wrap}>
      <View style={ps.row}>
        {pills.map(p => (
          <Pressable
            key={p.key}
            onPress={() => onChange(p.key)}
            style={[ps.pill, value === p.key && ps.pillActive]}>
            <Text style={[ps.pillText, value === p.key && ps.pillTextActive]}>
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {value === 'custom' && (
        <View style={ps.dateRow}>
          <TextInput
            style={ps.dateInput}
            value={customStart}
            onChangeText={onCustomStartChange}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textFaint}
          />
          <Text style={ps.dateTo}>to</Text>
          <TextInput
            style={ps.dateInput}
            value={customEnd}
            onChangeText={onCustomEndChange}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textFaint}
          />
        </View>
      )}
    </View>
  );
}

const ps = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.sm },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  pillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillText: { color: colors.text, fontSize: font.small, fontWeight: '600' },
  pillTextActive: { color: '#fff' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dateInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 6,
    paddingHorizontal: 10,
    color: colors.text,
    fontSize: font.small,
  },
  dateTo: { color: colors.textMuted, fontSize: font.small },
});

export function AdminDashboardScreen() {
  const nav = useNavigation<any>();
  const toast = useToast();
  const today = todayISO();
  const weekStartStr = getWeekStart(today);
  const weekEndStr = getWeekEnd(weekStartStr);
  const monthStartStr = getMonthStart(today);
  const monthEndStr = getMonthEnd(today);
  const { users } = useUsers();
  const { feedbacks } = useFeedbacksForAdmin();
  const menu = useMenuItems();
  const { settings, refetch: refetchSettings } = useSettings();

  const [expensePeriod, setExpensePeriod] = useState<Period>('day');
  const [expCustomStart, setExpCustomStart] = useState(today);
  const [expCustomEnd, setExpCustomEnd] = useState(today);
  const [dishPeriod, setDishPeriod] = useState<Period>('day');
  const [dishCustomStart, setDishCustomStart] = useState(today);
  const [dishCustomEnd, setDishCustomEnd] = useState(today);

  const [capEditing, setCapEditing] = useState(false);
  const [capInput, setCapInput] = useState('');
  const [capSaving, setCapSaving] = useState(false);

  function getRange(period: Period, cs: string, ce: string): [string, string] {
    switch (period) {
      case 'day': return [today, today];
      case 'week': return [weekStartStr, weekEndStr];
      case 'month': return [monthStartStr, monthEndStr];
      case 'custom': return [cs, ce];
    }
  }

  const [expStart, expEnd] = getRange(expensePeriod, expCustomStart, expCustomEnd);
  const [dshStart, dshEnd] = getRange(dishPeriod, dishCustomStart, dishCustomEnd);

  const [expenseOrders, setExpenseOrders] = useState<ConfirmedOrder[]>([]);
  const [dishOrders, setDishOrders] = useState<ConfirmedOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const priceMap = useMemo(() => {
    const m = new Map<string, number>();
    menu.items.forEach(i => m.set(i._id, i.pricePerUnit ?? 0));
    return m;
  }, [menu.items]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [expRes, dshRes] = await Promise.all([
        gqlRequest<{ confirmedOrdersForRange: any[] }>(CONFIRMED_ORDERS_FOR_RANGE, { startDate: expStart, endDate: expEnd }),
        gqlRequest<{ confirmedOrdersForRange: any[] }>(CONFIRMED_ORDERS_FOR_RANGE, { startDate: dshStart, endDate: dshEnd }),
      ]);
      const map = (arr: any[]) => arr.map((o: any) => ({ ...o, _id: o.id }));
      setExpenseOrders(map(expRes.confirmedOrdersForRange ?? []));
      setDishOrders(map(dshRes.confirmedOrdersForRange ?? []));
    } catch {
    } finally {
      setLoading(false);
    }
  }, [expStart, expEnd, dshStart, dshEnd]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const expenseData = useMemo(() => orderCost(expenseOrders, priceMap), [expenseOrders, priceMap]);
  const dishData = useMemo(() => computeDishBreakdown(dishOrders), [dishOrders]);

  const roleCounts = useMemo(() => {
    const c = { person: 0, admin: 0, vendor: 0 };
    users.forEach(u => { c[u.role]++; });
    return c;
  }, [users]);

  const pending = feedbacks.filter(f => f.status === 'pending').length;

  const handleSaveCap = async (value: number | null) => {
    setCapSaving(true);
    try {
      await gqlRequest(UPDATE_SETTINGS, { weeklyMealCap: value });
      toast.show('Weekly cap updated.', 'success');
      setCapEditing(false);
      refetchSettings();
    } catch (e) {
      toast.show((e as Error).message, 'error');
    } finally {
      setCapSaving(false);
    }
  };

  return (
    <Screen
      title="Dashboard"
      subtitle={formatLong(today)}
      headerRight={<SignOutButton />}
      refreshing={loading}
      onRefresh={load}>
      {loading && expenseOrders.length === 0 ? (
        <Loader label="Crunching numbers…" />
      ) : (
        <>
          {/* Team Summary */}
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
                <Text style={styles.link} onPress={() => nav.navigate('Feedback')}>
                  Review →
                </Text>
              </View>
            </View>
          </Card>

          {/* Weekly Meal Cap */}
          <SectionLabel>Weekly Meal Price Cap</SectionLabel>
          <Card>
            {!capEditing ? (
              <View style={styles.capRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.capValue}>
                    {settings.weeklyMealCap != null ? `₹${settings.weeklyMealCap}` : 'No cap set'}
                  </Text>
                  <Text style={styles.capSub}>
                    {settings.weeklyMealCap != null ? 'Per user, per week' : 'Users can order unlimited meals'}
                  </Text>
                </View>
                <Button
                  title="Edit"
                  variant="outline"
                  onPress={() => {
                    setCapInput(settings.weeklyMealCap != null ? String(settings.weeklyMealCap) : '');
                    setCapEditing(true);
                  }}
                />
              </View>
            ) : (
              <View>
                <View style={styles.capEditRow}>
                  <TextInput
                    style={styles.capInput}
                    value={capInput}
                    onChangeText={setCapInput}
                    placeholder="e.g. 500"
                    placeholderTextColor={colors.textFaint}
                    keyboardType="numeric"
                  />
                  <Button
                    title={capSaving ? 'Saving…' : 'Save'}
                    onPress={() => {
                      const val = capInput.trim() === '' ? null : parseFloat(capInput);
                      handleSaveCap(val);
                    }}
                    loading={capSaving}
                  />
                  <Button title="Cancel" variant="outline" onPress={() => setCapEditing(false)} />
                </View>
                {settings.weeklyMealCap != null && (
                  <Button
                    title="Remove cap"
                    variant="danger"
                    onPress={() => handleSaveCap(null)}
                    loading={capSaving}
                    style={{ marginTop: spacing.sm }}
                    fullWidth
                  />
                )}
              </View>
            )}
          </Card>

          {/* Expenses */}
          <SectionLabel>Expenses</SectionLabel>
          <Card>
            <PeriodSelector
              value={expensePeriod}
              onChange={setExpensePeriod}
              customStart={expCustomStart}
              customEnd={expCustomEnd}
              onCustomStartChange={setExpCustomStart}
              onCustomEndChange={setExpCustomEnd}
            />
            <Text style={styles.bigMoney}>₹{Math.round(expenseData.total)}</Text>
            <Text style={styles.statLabel}>
              {expenseOrders.length} confirmed meal{expenseOrders.length !== 1 ? 's' : ''}
              {expenseData.perPerson.length > 0 && ` · avg ₹${Math.round(expenseData.total / expenseData.perPerson.length)} / person`}
            </Text>
            {expenseData.perPerson.length > 0 && (
              <View style={styles.personList}>
                {expenseData.perPerson.map(p => (
                  <View key={p.userId} style={styles.personRow}>
                    <Text style={styles.personName}>{p.userName}</Text>
                    <Text style={styles.personCost}>₹{Math.round(p.total)}</Text>
                  </View>
                ))}
              </View>
            )}
          </Card>

          {/* Dish Breakdown */}
          <SectionLabel>Dish-wise Breakdown</SectionLabel>
          <Card>
            <PeriodSelector
              value={dishPeriod}
              onChange={setDishPeriod}
              customStart={dishCustomStart}
              customEnd={dishCustomEnd}
              onCustomStartChange={setDishCustomStart}
              onCustomEndChange={setDishCustomEnd}
            />
            {dishData.length === 0 ? (
              <Text style={styles.emptyText}>No orders in this period.</Text>
            ) : (
              <View>
                {dishData.map((d, i) => (
                  <View key={i} style={styles.dishRow}>
                    <Text style={styles.dishName}>{d.name}</Text>
                    <Text style={styles.dishQty}>{d.quantity} {d.unit}</Text>
                  </View>
                ))}
              </View>
            )}
          </Card>

          <Text style={styles.footerNote}>
            Based on confirmed orders and menu item prices.
          </Text>
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
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryStat: { alignItems: 'center', flex: 1 },
  summaryValue: { color: colors.text, fontSize: font.h2, fontWeight: '800' },
  summaryLabel: { color: colors.textMuted, fontSize: font.small, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.lg },
  feedbackRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  feedbackText: { color: colors.text, fontSize: font.body },
  feedbackRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  link: { color: colors.primary, fontSize: font.small, fontWeight: '700' },

  bigMoney: { color: colors.text, fontSize: 28, fontWeight: '900' },
  statLabel: { color: colors.textMuted, fontSize: font.small, marginTop: 4, marginBottom: spacing.sm },

  personList: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.sm, paddingTop: spacing.sm },
  personRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  personName: { color: colors.text, fontSize: font.body, flex: 1 },
  personCost: { color: colors.primary, fontSize: font.body, fontWeight: '700' },

  dishRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dishName: { color: colors.text, fontSize: font.body, flex: 1 },
  dishQty: { color: colors.primary, fontSize: font.small, fontWeight: '700' },

  emptyText: { color: colors.textFaint, fontSize: font.small, fontStyle: 'italic' },

  capRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  capValue: { color: colors.text, fontSize: 22, fontWeight: '800' },
  capSub: { color: colors.textMuted, fontSize: font.small, marginTop: 2 },
  capEditRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  capInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
    color: colors.text,
    fontSize: font.body,
  },

  footerNote: {
    color: colors.textFaint,
    fontSize: font.tiny,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
});
