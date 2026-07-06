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
import { useAggregatedOrder, useMenuItems } from '../../api/hooks';
import { gqlRequest } from '../../api/client';
import { CONFIRM_ORDER_WITH_ITEMS } from '../../api/operations';
import { useToast } from '../../context/ToastContext';
import { colors, font, mealMeta, radius, spacing } from '../../theme';
import { addDays, formatShort, isToday, todayISO } from '../../utils/date';
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

  const { aggregated, loading, refetch } = useAggregatedOrder(date, meal);
  const menu = useMenuItems(meal);

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

  return (
    <Screen
      title="Combine orders"
      headerRight={<SignOutButton />}
      refreshing={loading}
      onRefresh={refetch}>
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
