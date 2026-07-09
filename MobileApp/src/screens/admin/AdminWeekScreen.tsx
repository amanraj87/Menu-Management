import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../ui/Screen';
import { Button, Card, Loader, SectionLabel } from '../../ui';
import { SignOutButton } from '../../ui/SignOutButton';
import { gqlRequest } from '../../api/client';
import {
  AGGREGATED_ORDER,
  CONFIRMED_ORDERS_FOR_RANGE,
  CONFIRM_ORDER_WITH_ITEMS,
  TOGGLE_MEAL_CANCELLATION,
  UPDATE_SETTINGS,
} from '../../api/operations';
import { useMenuItems, useSettings, useMealCancellationsForRange, useVendorDayNotesForRange } from '../../api/hooks';
import { colors, font, mealMeta, radius, spacing } from '../../theme';
import { addDays, formatShort, isToday, todayISO, weekStart as getWeekStart } from '../../utils/date';
import { MEAL_TYPES, type ConfirmedOrder, type MealType } from '../../types';
import { useToast } from '../../context/ToastContext';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function dayName(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return DAY_NAMES[new Date(y, m - 1, d).getDay()];
}

type Row = { menuItemId: string; name: string; unit: string; qty: number; unitPrice: number; amount: number };

export function AdminWeekScreen() {
  const toast = useToast();
  const [wkStart, setWkStart] = useState(() => getWeekStart(todayISO()));
  const [ordersByDate, setOrdersByDate] = useState<Record<string, ConfirmedOrder[]>>({});
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const menu = useMenuItems();
  const { settings, refetch: refetchSettings } = useSettings();
  const delivery = settings.deliveryCharge ?? 0;

  const [capEditing, setCapEditing] = useState(false);
  const [capInput, setCapInput] = useState('');
  const [capSaving, setCapSaving] = useState(false);
  const [deliveryEditing, setDeliveryEditing] = useState(false);
  const [deliveryInput, setDeliveryInput] = useState('');
  const [deliverySaving, setDeliverySaving] = useState(false);
  const [weekConfirming, setWeekConfirming] = useState(false);
  const [weekProgress, setWeekProgress] = useState('');
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());
  const [editingMeal, setEditingMeal] = useState<{ date: string; meal: MealType } | null>(null);
  const [editQtys, setEditQtys] = useState<Record<string, number>>({});
  const [editNewId, setEditNewId] = useState('');
  const [editNewQty, setEditNewQty] = useState('1');
  const [editSaving, setEditSaving] = useState(false);
  // One shared guard for every write that touches confirmed orders — running
  // confirm/edit concurrently (or against a stale/unloaded ordersByDate)
  // interleaves full-replace writes and loses items.
  const writeBusy = weekConfirming || editSaving || loading;

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(wkStart, i)),
    [wkStart],
  );
  const wkEnd = addDays(wkStart, 6);

  const { cancellations, refetch: refetchCancellations } = useMealCancellationsForRange(wkStart, wkEnd);
  const { notes: vendorNotes } = useVendorDayNotesForRange(wkStart, wkEnd);
  const vendorNotesByDate = useMemo(() => {
    const map: Record<string, { finalAmount: number | null; comment: string }> = {};
    vendorNotes.forEach(n => { map[n.date] = { finalAmount: n.finalAmount, comment: n.comment }; });
    return map;
  }, [vendorNotes]);

  const toggleDayCollapse = (date: string) => {
    setCollapsedDays(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const menuByMeal = useMemo(() => {
    const map: Record<MealType, typeof menu.items> = { breakfast: [], lunch: [], dinner: [] };
    menu.items.forEach(m => { if (m.mealType && map[m.mealType]) map[m.mealType].push(m); });
    return map;
  }, [menu.items]);

  const handleStartEdit = (date: string, meal: MealType) => {
    if (writeBusy) return;
    const rows = (ordersByDate[date] ?? [])
      .filter(o => o.mealType === meal)
      .flatMap(o => o.items);
    const qtys: Record<string, number> = {};
    for (const it of rows) qtys[it.menuItemId] = it.quantity;
    setEditQtys(qtys);
    setEditNewId('');
    setEditNewQty('1');
    setEditingMeal({ date, meal });
  };

  const handleSaveEdit = async () => {
    if (!editingMeal || weekConfirming || loading) return;
    const { date, meal } = editingMeal;

    const existing = (ordersByDate[date] ?? [])
      .filter(o => o.mealType === meal)
      .flatMap(o => o.items);

    const items: { menuItemId: string; name: string; unit: string; quantity: number }[] = [];
    for (const it of existing) {
      const qty = editQtys[it.menuItemId] ?? 0;
      if (qty > 0) items.push({ menuItemId: it.menuItemId, name: it.name, unit: it.unit, quantity: qty });
    }

    if (editNewId) {
      const mi = menu.items.find(m => m._id === editNewId);
      const nq = Math.max(1, Math.round(Number(editNewQty) || 1));
      if (mi) {
        const idx = items.findIndex(i => i.menuItemId === editNewId);
        if (idx >= 0) items[idx] = { ...items[idx], quantity: items[idx].quantity + nq };
        else items.push({ menuItemId: mi._id, name: mi.name, unit: mi.unit ?? '', quantity: nq });
      }
    }

    setEditSaving(true);
    try {
      await gqlRequest(CONFIRM_ORDER_WITH_ITEMS, { date, mealType: meal, items });
      toast.show('Saved.', 'success');
      setEditingMeal(null);
      load();
    } catch (e) {
      toast.show((e as Error).message, 'error');
    } finally {
      setEditSaving(false);
    }
  };

  const cancelledSet = useMemo(() => {
    const s = new Set<string>();
    cancellations.forEach(c => s.add(`${c.date}|${c.mealType}`));
    return s;
  }, [cancellations]);
  const [toggling, setToggling] = useState(false);

  const priceMap = useMemo(() => {
    const m = new Map<string, number>();
    menu.items.forEach(i => m.set(i._id, i.pricePerUnit ?? 0));
    return m;
  }, [menu.items]);

  const handleToggleCancel = async (date: string, meal: MealType, currentlyCancelled: boolean) => {
    setToggling(true);
    try {
      await gqlRequest(TOGGLE_MEAL_CANCELLATION, { date, mealType: meal, cancelled: !currentlyCancelled });
      await refetchCancellations();
    } catch (e) {
      toast.show((e as Error).message, 'error');
    } finally {
      setToggling(false);
    }
  };

  const handleSaveCap = async (value: number | null) => {
    if (value != null && (!Number.isFinite(value) || value < 0)) {
      toast.show('Cap must be a non-negative number', 'error');
      return;
    }
    setCapSaving(true);
    try {
      await gqlRequest(UPDATE_SETTINGS, { monthlyMealCap: value, deliveryCharge: settings.deliveryCharge });
      toast.show('Monthly cap updated.', 'success');
      setCapEditing(false);
      refetchSettings();
    } catch (e) {
      toast.show((e as Error).message, 'error');
    } finally {
      setCapSaving(false);
    }
  };

  const handleSaveDelivery = async (value: number | null) => {
    if (value != null && (!Number.isFinite(value) || value < 0)) {
      toast.show('Delivery charge must be a non-negative number', 'error');
      return;
    }
    setDeliverySaving(true);
    try {
      await gqlRequest(UPDATE_SETTINGS, { monthlyMealCap: settings.monthlyMealCap, deliveryCharge: value });
      toast.show('Delivery charge updated.', 'success');
      setDeliveryEditing(false);
      refetchSettings();
    } catch (e) {
      toast.show((e as Error).message, 'error');
    } finally {
      setDeliverySaving(false);
    }
  };

  const handleConfirmWeek = async () => {
    if (writeBusy) return;
    const combos = days.flatMap(d => MEAL_TYPES.map(m => ({ date: d, meal: m })));
    setWeekConfirming(true);
    setWeekProgress('');
    let confirmed = 0;
    let skipped = 0;
    let done = 0;
    try {
      for (const { date: d, meal: m } of combos) {
        const res = await gqlRequest<{ aggregatedOrder: { items: any[] } | null }>(
          AGGREGATED_ORDER,
          { date: d, mealType: m },
        );
        const aggItems = res.aggregatedOrder?.items ?? [];
        if (aggItems.length === 0) {
          skipped++;
        } else {
          const existing = (ordersByDate[d] ?? [])
            .filter(o => o.mealType === m)
            .flatMap(o => o.items);
          // Existing items (imports/manual adds) are kept; aggregated user
          // selections overwrite their own items so re-confirming is idempotent.
          const merged = new Map<string, { menuItemId: string; name: string; unit: string; quantity: number }>();
          for (const it of existing) merged.set(it.menuItemId, { menuItemId: it.menuItemId, name: it.name, unit: it.unit, quantity: it.quantity });
          for (const it of aggItems) {
            merged.set(it.menuItemId, { menuItemId: it.menuItemId, name: it.name, unit: it.unit, quantity: it.quantity });
          }
          await gqlRequest(CONFIRM_ORDER_WITH_ITEMS, {
            date: d,
            mealType: m,
            items: Array.from(merged.values()),
          });
          confirmed++;
        }
        done++;
        setWeekProgress(`Processing ${done}/${combos.length}…`);
      }
      toast.show(
        confirmed > 0
          ? `Confirmed ${confirmed} meal${confirmed === 1 ? '' : 's'} (${skipped} had no selections).`
          : 'No selections found for any meal this week.',
        confirmed > 0 ? 'success' : 'info',
      );
      await load();
    } catch (e) {
      toast.show((e as Error).message, 'error');
    } finally {
      setWeekConfirming(false);
      setWeekProgress('');
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await gqlRequest<{ confirmedOrdersForRange: any[] }>(
        CONFIRMED_ORDERS_FOR_RANGE,
        { startDate: wkStart, endDate: wkEnd },
      );
      const map: Record<string, ConfirmedOrder[]> = {};
      (res.confirmedOrdersForRange ?? []).forEach((o: any) => {
        const order = { ...o, _id: o.id };
        (map[o.date] = map[o.date] ?? []).push(order);
      });
      setOrdersByDate(map);
    } catch (e) {
      toast.show(`Failed to load week: ${(e as Error).message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [wkStart, wkEnd, toast]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const buildMeals = (date: string, orders: ConfirmedOrder[]) => {
    const meals: Record<MealType, Row[]> = { breakfast: [], lunch: [], dinner: [] };
    const subtotals: Record<MealType, number> = { breakfast: 0, lunch: 0, dinner: 0 };
    const cancelled: Record<MealType, boolean> = {
      breakfast: cancelledSet.has(`${date}|breakfast`),
      lunch: cancelledSet.has(`${date}|lunch`),
      dinner: cancelledSet.has(`${date}|dinner`),
    };
    orders.forEach(o => {
      o.items.forEach(it => {
        const unitPrice = priceMap.get(it.menuItemId) ?? 0;
        const amount = unitPrice * it.quantity;
        meals[o.mealType].push({ menuItemId: it.menuItemId, name: it.name, unit: it.unit, qty: it.quantity, unitPrice, amount });
        subtotals[o.mealType] += amount;
      });
    });
    const mealsTotal = MEAL_TYPES.reduce((s, m) => s + (cancelled[m] ? 0 : subtotals[m]), 0);
    return { meals, subtotals, cancelled, mealsTotal };
  };

  const today = todayISO();
  const weekTotal = days.reduce((sum, date) => {
    const { mealsTotal } = buildMeals(date, ordersByDate[date] ?? []);
    return sum + mealsTotal + (mealsTotal > 0 ? delivery : 0);
  }, 0);
  const expenseTillNow = days.reduce((sum, date) => {
    if (date > today) return sum;
    const { mealsTotal } = buildMeals(date, ordersByDate[date] ?? []);
    return sum + mealsTotal + (mealsTotal > 0 ? delivery : 0);
  }, 0);

  return (
    <Screen
      title="Week"
      subtitle="Orders & cancellations"
      headerRight={<SignOutButton />}
      refreshing={loading}
      onRefresh={load}>
      {/* Settings (collapsible) */}
      <Card padded>
        <Pressable onPress={() => setSettingsOpen(!settingsOpen)} style={styles.settingsHeader}>
          <Text style={styles.settingsTitle}>Settings</Text>
          <Text style={styles.settingsSummary}>
            Cap: {settings.monthlyMealCap != null ? `₹${settings.monthlyMealCap}/mo` : 'None'} · Delivery: {settings.deliveryCharge != null ? `₹${settings.deliveryCharge}` : 'None'} {settingsOpen ? '▴' : '▾'}
          </Text>
        </Pressable>
        {settingsOpen && (
          <View style={styles.settingsBody}>
            {/* Monthly cap */}
            <SectionLabel>Monthly Meal Price Cap</SectionLabel>
            {!capEditing ? (
              <View style={styles.settingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingValue}>
                    {settings.monthlyMealCap != null ? `₹${settings.monthlyMealCap}` : 'No cap set'}
                  </Text>
                </View>
                <Button title="Edit" variant="outline" onPress={() => { setCapInput(settings.monthlyMealCap != null ? String(settings.monthlyMealCap) : ''); setCapEditing(true); }} />
              </View>
            ) : (
              <View>
                <View style={styles.settingEditRow}>
                  <TextInput style={styles.settingInput} value={capInput} onChangeText={setCapInput} placeholder="e.g. 500" placeholderTextColor={colors.textFaint} keyboardType="numeric" />
                  <Button title={capSaving ? '…' : 'Save'} onPress={() => handleSaveCap(capInput.trim() === '' ? null : parseFloat(capInput))} loading={capSaving} />
                  <Button title="Cancel" variant="outline" onPress={() => setCapEditing(false)} />
                </View>
                {settings.monthlyMealCap != null && (
                  <Button title="Remove cap" variant="danger" onPress={() => handleSaveCap(null)} loading={capSaving} style={{ marginTop: spacing.sm }} fullWidth />
                )}
              </View>
            )}

            {/* Delivery charge */}
            <SectionLabel>Delivery Charge</SectionLabel>
            {!deliveryEditing ? (
              <View style={styles.settingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingValue}>
                    {settings.deliveryCharge != null ? `₹${settings.deliveryCharge}` : 'No charge set'}
                  </Text>
                </View>
                <Button title="Edit" variant="outline" onPress={() => { setDeliveryInput(settings.deliveryCharge != null ? String(settings.deliveryCharge) : ''); setDeliveryEditing(true); }} />
              </View>
            ) : (
              <View>
                <View style={styles.settingEditRow}>
                  <TextInput style={styles.settingInput} value={deliveryInput} onChangeText={setDeliveryInput} placeholder="e.g. 120" placeholderTextColor={colors.textFaint} keyboardType="numeric" />
                  <Button title={deliverySaving ? '…' : 'Save'} onPress={() => handleSaveDelivery(deliveryInput.trim() === '' ? null : parseFloat(deliveryInput))} loading={deliverySaving} />
                  <Button title="Cancel" variant="outline" onPress={() => setDeliveryEditing(false)} />
                </View>
                {settings.deliveryCharge != null && (
                  <Button title="Remove" variant="danger" onPress={() => handleSaveDelivery(null)} loading={deliverySaving} style={{ marginTop: spacing.sm }} fullWidth />
                )}
              </View>
            )}
          </View>
        )}
      </Card>

      {/* Week nav */}
      <View style={{ height: spacing.md }} />
      <View style={styles.weekNav}>
        <Pressable style={styles.navBtn} onPress={() => setWkStart(addDays(wkStart, -7))} hitSlop={8}>
          <Text style={styles.navBtnText}>‹</Text>
        </Pressable>
        <View style={styles.weekLabelWrap}>
          <Text style={styles.weekLabel}>{formatShort(wkStart)} – {formatShort(wkEnd)}</Text>
          <Text style={styles.weekTotal}>₹{Math.round(expenseTillNow)} / ₹{Math.round(weekTotal)}</Text>
          <Text style={styles.expenseHint}>spent till now / week total</Text>
        </View>
        <Pressable style={styles.navBtn} onPress={() => setWkStart(addDays(wkStart, 7))} hitSlop={8}>
          <Text style={styles.navBtnText}>›</Text>
        </Pressable>
      </View>

      {/* Action buttons */}
      <Button
        title={weekConfirming ? (weekProgress || 'Confirming…') : 'Confirm all meals for the week'}
        icon="✓"
        onPress={handleConfirmWeek}
        loading={weekConfirming}
        disabled={writeBusy}
        fullWidth
      />

      {loading && Object.keys(ordersByDate).length === 0 ? (
        <Loader label="Loading week…" />
      ) : (
        days.map(date => {
          const orders = ordersByDate[date] ?? [];
          const { meals, subtotals, cancelled, mealsTotal } = buildMeals(date, orders);
          const dayTotal = mealsTotal + (mealsTotal > 0 ? delivery : 0);
          const collapsed = collapsedDays.has(date);
          const vendorNote = vendorNotesByDate[date];

          return (
            <Card key={date} padded={false}>
              <Pressable onPress={() => toggleDayCollapse(date)} style={styles.dayHeader}>
                <View style={styles.dayHeaderLeft}>
                  <Text style={[styles.chevron, collapsed && styles.chevronCollapsed]}>▾</Text>
                  <Text style={styles.dayTitle}>{dayName(date)} · {formatShort(date)}</Text>
                  {isToday(date) && <Text style={styles.todayBadge}>Today</Text>}
                </View>
                <Text style={styles.dayAmount}>₹{Math.round(dayTotal)}</Text>
              </Pressable>

              {collapsed ? (
                vendorNote?.comment ? (
                  <View style={styles.collapsedComment}>
                    <Text style={styles.collapsedCommentText}>{vendorNote.comment}</Text>
                  </View>
                ) : null
              ) : (
                <View style={styles.body}>
                  {MEAL_TYPES.map(meal => {
                    const rows = meals[meal];
                    const isCancelled = cancelled[meal];
                    const isEditing = editingMeal?.date === date && editingMeal?.meal === meal;
                    return (
                      <View key={meal} style={[styles.mealGroup, isCancelled && styles.mealGroupCancelled]}>
                        <View style={styles.mealHeadRow}>
                          <Text style={[styles.mealLabel, isCancelled && styles.mealLabelCancelled]}>
                            {mealMeta[meal].icon} {mealMeta[meal].label}
                          </Text>
                          <View style={styles.mealActions}>
                            {!isCancelled && !isEditing && (
                              <Pressable
                                onPress={() => handleStartEdit(date, meal)}
                                hitSlop={6}
                                style={styles.editBtn}>
                                <Text style={styles.editBtnText}>✏️</Text>
                              </Pressable>
                            )}
                            <Pressable
                              onPress={() => handleToggleCancel(date, meal, isCancelled)}
                              disabled={toggling}
                              hitSlop={6}
                              style={[styles.toggleTrack, isCancelled && styles.toggleTrackActive]}>
                              <View style={[styles.toggleThumb, isCancelled && styles.toggleThumbActive]} />
                            </Pressable>
                          </View>
                        </View>
                        {isCancelled ? (
                          <Text style={styles.cancelledNote}>Cancelled — kitchen closed</Text>
                        ) : (
                          <>
                            {isEditing ? (
                              <View style={styles.editForm}>
                                {rows.map((r) => (
                                  <View key={r.menuItemId} style={styles.editRow}>
                                    <Text style={styles.editItemName} numberOfLines={1}>{r.name}</Text>
                                    <TextInput
                                      style={styles.editQtyInput}
                                      value={String(editQtys[r.menuItemId] ?? 0)}
                                      onChangeText={(v) => setEditQtys(prev => ({ ...prev, [r.menuItemId]: Math.max(0, Number(v) || 0) }))}
                                      keyboardType="numeric"
                                    />
                                    <Text style={styles.editUnit}>{r.unit}</Text>
                                  </View>
                                ))}
                                <View style={styles.editAddSection}>
                                  <View style={styles.addItemPickerWrap}>
                                    {menuByMeal[meal]
                                      .filter(mi => !rows.some(r => r.menuItemId === mi._id))
                                      .map(mi => (
                                        <Pressable
                                          key={mi._id}
                                          onPress={() => setEditNewId(mi._id)}
                                          style={[styles.addItemOption, editNewId === mi._id && styles.addItemOptionSelected]}>
                                          <Text style={[styles.addItemOptionText, editNewId === mi._id && styles.addItemOptionTextSelected]} numberOfLines={1}>
                                            + {mi.name} ({mi.unit}{mi.pricePerUnit != null ? ` · ₹${mi.pricePerUnit}` : ''})
                                          </Text>
                                        </Pressable>
                                      ))}
                                  </View>
                                  {editNewId !== '' && (
                                    <TextInput
                                      style={styles.editQtyInput}
                                      value={editNewQty}
                                      onChangeText={setEditNewQty}
                                      keyboardType="numeric"
                                      placeholder="Qty"
                                      placeholderTextColor={colors.textFaint}
                                    />
                                  )}
                                </View>
                                <View style={styles.editActions}>
                                  <Button title={editSaving ? '…' : 'Save'} onPress={handleSaveEdit} loading={editSaving} />
                                  <Button title="Cancel" variant="outline" onPress={() => setEditingMeal(null)} />
                                </View>
                              </View>
                            ) : rows.length === 0 ? (
                              <Text style={styles.emptyRow}>No orders</Text>
                            ) : (
                              <>
                                <View style={styles.rowHead}>
                                  <Text style={[styles.colItem, styles.headText]}>Item</Text>
                                  <Text style={[styles.colQty, styles.headText]}>Qty</Text>
                                  <Text style={[styles.colPrice, styles.headText]}>Price</Text>
                                  <Text style={[styles.colAmt, styles.headText]}>Amount</Text>
                                </View>
                                {rows.map((r, i) => (
                                  <View key={`${meal}-${i}`} style={styles.itemRow}>
                                    <Text style={styles.colItem} numberOfLines={1}>{r.name}</Text>
                                    <Text style={styles.colQty}>{r.qty}</Text>
                                    <Text style={styles.colPrice}>{r.unitPrice}</Text>
                                    <Text style={styles.colAmt}>{Math.round(r.amount)}</Text>
                                  </View>
                                ))}
                                <View style={styles.subtotalRow}>
                                  <Text style={styles.subtotalLabel}>Subtotal</Text>
                                  <Text style={styles.subtotalValue}>₹{Math.round(subtotals[meal])}</Text>
                                </View>
                              </>
                            )}
                          </>
                        )}
                      </View>
                    );
                  })}
                  <View style={styles.dayFooter}>
                    <View style={styles.footerLine}>
                      <Text style={styles.footerLabel}>Delivery</Text>
                      <Text style={styles.footerValue}>{delivery > 0 && mealsTotal > 0 ? `₹${Math.round(delivery)}` : '—'}</Text>
                    </View>
                    <View style={styles.footerLine}>
                      <Text style={styles.footerTotalLabel}>Day total</Text>
                      <Text style={styles.footerTotalValue}>₹{Math.round(dayTotal)}</Text>
                    </View>
                  </View>
                  {vendorNote?.comment && (
                    <View style={styles.collapsedComment}>
                      <Text style={styles.collapsedCommentText}>Vendor: {vendorNote.comment}</Text>
                    </View>
                  )}
                </View>
              )}
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  settingsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingsTitle: { color: colors.text, fontSize: font.body, fontWeight: '700' },
  settingsSummary: { color: colors.textMuted, fontSize: font.tiny },
  settingsBody: { marginTop: spacing.md },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingValue: { color: colors.text, fontSize: 18, fontWeight: '800' },
  settingEditRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  settingInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
    color: colors.text,
    fontSize: font.body,
  },

  weekNav: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
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
  weekTotal: { color: colors.primary, fontSize: font.small, fontWeight: '700', marginTop: 2 },
  expenseHint: { color: colors.textFaint, fontSize: font.tiny, marginTop: 1 },

  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  dayHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1 },
  chevron: { color: colors.textMuted, fontSize: font.small },
  chevronCollapsed: { transform: [{ rotate: '-90deg' }] },
  dayTitle: { color: colors.text, fontSize: font.body, fontWeight: '700' },
  todayBadge: {
    fontSize: font.tiny,
    fontWeight: '700',
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    overflow: 'hidden',
  },
  dayAmount: { color: colors.text, fontSize: 18, fontWeight: '800' },
  collapsedComment: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  collapsedCommentText: { color: colors.textMuted, fontSize: font.small, fontStyle: 'italic' },

  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  totalPill: {
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    minWidth: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  totalPillText: { color: colors.primary, fontWeight: '800', fontSize: font.small },
  emptyRow: { color: colors.textFaint, fontStyle: 'italic', fontSize: font.small },

  mealActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  editBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtnText: { fontSize: 13 },
  editForm: { padding: spacing.sm, gap: spacing.sm },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  editItemName: { flex: 1, fontSize: font.small, fontWeight: '500', color: colors.text },
  editQtyInput: {
    width: 54,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    color: colors.text,
    fontSize: font.small,
    textAlign: 'center',
  },
  editUnit: { fontSize: font.tiny, color: colors.textMuted, minWidth: 30 },
  editAddSection: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, gap: spacing.sm },
  editActions: { flexDirection: 'row', gap: spacing.sm },
  addItemForm: { marginTop: spacing.sm, gap: spacing.sm },
  addItemPickerWrap: { gap: 4 },
  addItemOption: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  addItemOptionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  addItemOptionText: { color: colors.text, fontSize: font.small },
  addItemOptionTextSelected: { color: colors.primary, fontWeight: '700' },
  addItemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  addItemQtyInput: {
    width: 60,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
    color: colors.text,
    fontSize: font.body,
  },

  mealGroup: { marginTop: spacing.md },
  mealGroupCancelled: { opacity: 0.6 },
  mealHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  mealLabel: { color: colors.textMuted, fontSize: font.small, fontWeight: '700' },
  mealLabelCancelled: { textDecorationLine: 'line-through' },
  toggleTrack: {
    width: 36,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: 'center',
  },
  toggleTrackActive: { backgroundColor: colors.border },
  toggleThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    position: 'absolute',
    left: 18,
  },
  toggleThumbActive: { left: 2 },
  cancelledNote: { color: colors.danger, fontSize: font.small, fontWeight: '600', paddingVertical: 4 },
  rowHead: { flexDirection: 'row', paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: colors.border },
  headText: { color: colors.textFaint, fontSize: font.tiny, fontWeight: '700' },
  itemRow: { flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: colors.border },
  colItem: { flex: 1, color: colors.text, fontSize: font.small },
  colQty: { width: 40, textAlign: 'right', color: colors.text, fontSize: font.small },
  colPrice: { width: 56, textAlign: 'right', color: colors.textMuted, fontSize: font.small },
  colAmt: { width: 64, textAlign: 'right', color: colors.text, fontSize: font.small, fontWeight: '600' },
  subtotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 5 },
  subtotalLabel: { color: colors.textMuted, fontSize: font.small, fontWeight: '700' },
  subtotalValue: { color: colors.text, fontSize: font.small, fontWeight: '700' },

  dayFooter: { marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  footerLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  footerLabel: { color: colors.textMuted, fontSize: font.small },
  footerValue: { color: colors.text, fontSize: font.small, fontWeight: '600' },
  footerTotalLabel: { color: colors.text, fontSize: font.body, fontWeight: '800' },
  footerTotalValue: { color: colors.primary, fontSize: font.body, fontWeight: '800' },
});
