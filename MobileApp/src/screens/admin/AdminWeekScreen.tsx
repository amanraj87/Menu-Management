import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../ui/Screen';
import { Button, Card, Loader, SectionLabel } from '../../ui';
import { SignOutButton } from '../../ui/SignOutButton';
import { gqlRequest } from '../../api/client';
import {
  ADMIN_SET_USER_SELECTION,
  AGGREGATED_ORDERS_FOR_RANGE,
  CONFIRMED_ORDERS_FOR_RANGE,
  CONFIRM_ORDER_WITH_ITEMS,
  RUN_AUTO_IMPORT,
  TOGGLE_MEAL_CANCELLATION,
  UPDATE_ADMIN_DAY_COMMENT,
  UPDATE_SETTINGS,
  REMIND_NOT_EATEN,
  NOTIFY_ORDERS_SENT_TO_VENDOR,
} from '../../api/operations';
import { useMenuItems, useUsers, useSettings, useMealCancellationsForRange, useVendorDayNotesForRange } from '../../api/hooks';
import { colors, font, mealMeta, radius, spacing } from '../../theme';
import { addDays, formatShort, isToday, todayISO, weekStart as getWeekStart } from '../../utils/date';
import { MEAL_TYPES, type MealType } from '../../types';
import { useToast } from '../../context/ToastContext';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function dayName(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return DAY_NAMES[new Date(y, m - 1, d).getDay()];
}

/** Keep only digits and a single decimal point so qty inputs accept floats. */
function sanitizeQty(v: string): string {
  let s = v.replace(/[^0-9.]/g, '');
  const dot = s.indexOf('.');
  if (dot !== -1) {
    s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '');
  }
  return s;
}

type PersonShare = { userId: string; userName: string; quantity: number };
type Row = { menuItemId: string; name: string; unit: string; qty: number; unitPrice: number; amount: number; personBreakdown: PersonShare[] };
type AggInfo = { name: string; unit: string; qty: number; personBreakdown: PersonShare[] };
/** A confirmed order as last sent to the vendor (raw; priced at render time). */
type SentOrder = { date: string; mealType: string; items: { menuItemId: string; quantity: number }[] };

/** Collapsible "who chose this" list, grouped by quantity (same qty on one line). */
function WhoChose({ breakdown }: { breakdown: PersonShare[] }) {
  const [open, setOpen] = useState(false);
  if (breakdown.length === 0) return null;
  const byQty = new Map<number, string[]>();
  for (const p of breakdown) {
    if (!byQty.has(p.quantity)) byQty.set(p.quantity, []);
    byQty.get(p.quantity)!.push(p.userName);
  }
  const groups = Array.from(byQty.entries()).sort((a, b) => b[0] - a[0]);
  const total = breakdown.length;
  return (
    <View style={styles.whoWrap}>
      <Pressable onPress={() => setOpen(o => !o)} hitSlop={4}>
        <Text style={styles.whoToggle}>
          👤 {total} {total === 1 ? 'person' : 'people'} {open ? '▴' : '▾'}
        </Text>
      </Pressable>
      {open && groups.map(([qty, names]) => (
        <Text key={qty} style={styles.whoGroupLine} numberOfLines={3}>
          <Text style={styles.whoQty}>{qty}× </Text>{names.join(', ')}
        </Text>
      ))}
    </View>
  );
}

export function AdminWeekScreen() {
  const toast = useToast();
  const [remindPending, setRemindPending] = useState(false);
  const [wkStart, setWkStart] = useState(() => getWeekStart(todayISO()));
  // Live combined user selections keyed by `${date}|${meal}` → (menuItemId → info).
  const [aggByKey, setAggByKey] = useState<Record<string, Record<string, AggInfo>>>({});
  // Raw confirmed orders last SENT to the vendor. Kept unpriced on purpose:
  // prices arrive with the menu query, so the subtotals are derived in a memo
  // below and recompute once it lands (see sentByDate).
  const [sentOrders, setSentOrders] = useState<SentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const menu = useMenuItems();
  const { users } = useUsers();
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
  const [autoImporting, setAutoImporting] = useState(false);
  const [toggling, setToggling] = useState(false);
  // Per-user selection editor (admin overwrites one user's picks for a meal).
  const [editing, setEditing] = useState<{ date: string; meal: MealType } | null>(null);
  const [editUserId, setEditUserId] = useState('');
  // Qty inputs are held as raw strings so decimals (e.g. "0.5") can be typed.
  const [editItems, setEditItems] = useState<Record<string, string>>({});
  const [editSaving, setEditSaving] = useState(false);
  const writeBusy = weekConfirming || loading;

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(wkStart, i)),
    [wkStart],
  );
  const wkEnd = addDays(wkStart, 6);

  const { cancellations, refetch: refetchCancellations } = useMealCancellationsForRange(wkStart, wkEnd);
  const { notes: vendorNotes, refetch: refetchNotes } = useVendorDayNotesForRange(wkStart, wkEnd);
  const vendorNotesByDate = useMemo(() => {
    const map: Record<string, { finalAmount: number | null; comment: string; adminComment: string }> = {};
    vendorNotes.forEach(n => { map[n.date] = { finalAmount: n.finalAmount, comment: n.comment, adminComment: n.adminComment }; });
    return map;
  }, [vendorNotes]);

  // Admin per-day comment / reply editor.
  const [commentEditDay, setCommentEditDay] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentSaving, setCommentSaving] = useState(false);

  const openCommentEdit = (date: string) => {
    setCommentDraft(vendorNotesByDate[date]?.adminComment ?? '');
    setCommentEditDay(date);
  };
  const saveAdminComment = async (date: string) => {
    setCommentSaving(true);
    try {
      await gqlRequest(UPDATE_ADMIN_DAY_COMMENT, { date, comment: commentDraft.trim() });
      await refetchNotes();
      setCommentEditDay(null);
    } catch (e) {
      toast.show((e as Error).message, 'error');
    } finally {
      setCommentSaving(false);
    }
  };

  const cancelledSet = useMemo(() => {
    const s = new Set<string>();
    cancellations.forEach(c => s.add(`${c.date}|${c.mealType}`));
    return s;
  }, [cancellations]);

  const priceMap = useMemo(() => {
    const m = new Map<string, number>();
    menu.items.forEach(i => m.set(i._id, i.pricePerUnit ?? 0));
    return m;
  }, [menu.items]);

  // Price the sent orders here rather than at fetch time: the menu (and so
  // priceMap) resolves independently, and pricing during load produced ₹0
  // subtotals whenever the fetch won that race.
  const sentByDate = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    // No prices yet → report "nothing sent" rather than ₹0, so the drift
    // warning can't flash before the menu resolves.
    if (priceMap.size === 0) return map;
    for (const o of sentOrders) {
      if (!map[o.date]) map[o.date] = {};
      let sum = 0;
      for (const it of o.items ?? []) {
        sum += (priceMap.get(it.menuItemId) ?? 0) * it.quantity;
      }
      map[o.date][o.mealType] = (map[o.date][o.mealType] ?? 0) + sum;
    }
    return map;
  }, [sentOrders, priceMap]);

  const menuById = useMemo(() => {
    const m = new Map<string, { name: string; unit: string }>();
    menu.items.forEach(i => m.set(i._id, { name: i.name, unit: i.unit ?? '' }));
    return m;
  }, [menu.items]);

  const menuByMeal = useMemo(() => {
    const map: Record<MealType, typeof menu.items> = { breakfast: [], lunch: [], dinner: [] };
    menu.items.forEach(m => { if (m.mealType && map[m.mealType]) map[m.mealType].push(m); });
    return map;
  }, [menu.items]);

  /** Reconstruct a single user's picks (menuItemId → qty) for a slot from the aggregate. */
  const userSelectionFor = (date: string, meal: MealType, userId: string): Record<string, number> => {
    const out: Record<string, number> = {};
    const agg = aggByKey[`${date}|${meal}`];
    if (agg) {
      for (const menuItemId of Object.keys(agg)) {
        const share = agg[menuItemId].personBreakdown.find(p => p.userId === userId);
        if (share) out[menuItemId] = share.quantity;
      }
    }
    return out;
  };

  const openEdit = (date: string, meal: MealType) => {
    setEditing({ date, meal });
    setEditUserId('');
    setEditItems({});
  };
  const pickEditUser = (userId: string) => {
    setEditUserId(userId);
    const sel = editing ? userSelectionFor(editing.date, editing.meal, userId) : {};
    setEditItems(Object.fromEntries(Object.entries(sel).map(([k, v]) => [k, String(v)])));
  };
  const handleSaveUserSelection = async () => {
    if (!editing || !editUserId) return;
    const { date, meal } = editing;
    const items = Object.entries(editItems)
      .map(([menuItemId, raw]) => ({ menuItemId, quantity: parseFloat(raw) }))
      .filter(({ quantity }) => Number.isFinite(quantity) && quantity > 0);
    setEditSaving(true);
    try {
      await gqlRequest(ADMIN_SET_USER_SELECTION, { userId: editUserId, date, mealType: meal, items });
      toast.show('User selection updated.', 'success');
      setEditing(null);
      await load();
    } catch (e) {
      toast.show((e as Error).message, 'error');
    } finally {
      setEditSaving(false);
    }
  };

  const toggleDayCollapse = (date: string) => {
    setCollapsedDays(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

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

  const handleRunAutoImport = async () => {
    if (autoImporting) return;
    setAutoImporting(true);
    try {
      const res = await gqlRequest<{ runAutoImport: number }>(RUN_AUTO_IMPORT, { targetWeekStart: wkStart });
      const n = res.runAutoImport ?? 0;
      toast.show(`Auto-import created ${n} selection slot${n === 1 ? '' : 's'} for this week.`, n > 0 ? 'success' : 'info');
      await load();
    } catch (e) {
      toast.show((e as Error).message, 'error');
    } finally {
      setAutoImporting(false);
    }
  };

  /** Push the current combined selections to the vendor (confirmed_orders). */
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
        const agg = aggByKey[`${d}|${m}`];
        const items = agg
          ? Object.entries(agg).map(([menuItemId, info]) => ({ menuItemId, name: info.name, unit: info.unit, quantity: info.qty }))
          : [];
        if (items.length === 0 || cancelledSet.has(`${d}|${m}`)) {
          skipped++;
        } else {
          await gqlRequest(CONFIRM_ORDER_WITH_ITEMS, { date: d, mealType: m, items });
          confirmed++;
        }
        done++;
        setWeekProgress(`Processing ${done}/${combos.length}…`);
      }
      // One push to the vendor for the whole batch (not one per meal).
      // On a weekday, reference just today's date; on the weekend, the week range.
      if (confirmed > 0 && days.length > 0) {
        const now = new Date();
        const isWeekend = now.getDay() === 0 || now.getDay() === 6;
        const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        await gqlRequest(NOTIFY_ORDERS_SENT_TO_VENDOR, {
          startDate: isWeekend ? days[0] : localToday,
          endDate: isWeekend ? days[days.length - 1] : localToday,
        }).catch(() => {});
      }
      toast.show(
        confirmed > 0
          ? `Sent ${confirmed} meal${confirmed === 1 ? '' : 's'} to the kitchen.`
          : 'No selections found for any meal this week.',
        confirmed > 0 ? 'success' : 'info',
      );
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
      const aggRes = await gqlRequest<{ aggregatedOrdersForRange: any[] }>(
        AGGREGATED_ORDERS_FOR_RANGE,
        { startDate: wkStart, endDate: wkEnd },
      );
      const agg: Record<string, Record<string, AggInfo>> = {};
      (aggRes.aggregatedOrdersForRange ?? []).forEach((a: any) => {
        const items: Record<string, AggInfo> = {};
        (a.items ?? []).forEach((it: any) => {
          items[it.menuItemId] = { name: it.name, unit: it.unit, qty: it.quantity, personBreakdown: it.personBreakdown ?? [] };
        });
        agg[`${a.date}|${a.mealType}`] = items;
      });
      setAggByKey(agg);

      // What the vendor was actually sent, so we can flag drift since the send.
      // Stored raw — pricing happens in the sentByDate memo.
      const sentRes = await gqlRequest<{ confirmedOrdersForRange: SentOrder[] }>(
        CONFIRMED_ORDERS_FOR_RANGE,
        { startDate: wkStart, endDate: wkEnd },
      );
      setSentOrders(sentRes.confirmedOrdersForRange ?? []);
    } catch (e) {
      toast.show(`Failed to load week: ${(e as Error).message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [wkStart, wkEnd, toast]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const buildMeals = (date: string) => {
    const meals: Record<MealType, Row[]> = { breakfast: [], lunch: [], dinner: [] };
    const subtotals: Record<MealType, number> = { breakfast: 0, lunch: 0, dinner: 0 };
    const cancelled: Record<MealType, boolean> = {
      breakfast: cancelledSet.has(`${date}|breakfast`),
      lunch: cancelledSet.has(`${date}|lunch`),
      dinner: cancelledSet.has(`${date}|dinner`),
    };
    for (const meal of MEAL_TYPES) {
      const agg = aggByKey[`${date}|${meal}`];
      if (!agg) continue;
      for (const menuItemId of Object.keys(agg)) {
        const info = agg[menuItemId];
        const unitPrice = priceMap.get(menuItemId) ?? 0;
        const amount = unitPrice * info.qty;
        meals[meal].push({ menuItemId, name: info.name, unit: info.unit, qty: info.qty, unitPrice, amount, personBreakdown: info.personBreakdown });
        subtotals[meal] += amount;
      }
    }
    const mealsTotal = MEAL_TYPES.reduce((s, m) => s + (cancelled[m] ? 0 : subtotals[m]), 0);
    // Delivery is charged per active meal (has an order and not cancelled).
    const activeMeals = MEAL_TYPES.filter(m => !cancelled[m] && subtotals[m] > 0).length;
    return { meals, subtotals, cancelled, mealsTotal, activeMeals };
  };

  /** Day total as last sent to the vendor, or null if nothing was sent that day. */
  const sentDayTotal = (date: string): number | null => {
    const subs = sentByDate[date];
    if (!subs) return null;
    let mealsTotal = 0;
    let activeMeals = 0;
    for (const meal of MEAL_TYPES) {
      if (cancelledSet.has(`${date}|${meal}`)) continue;
      const sub = subs[meal] ?? 0;
      if (sub <= 0) continue;
      mealsTotal += sub;
      activeMeals++;
    }
    return mealsTotal + delivery * activeMeals;
  };

  const today = todayISO();
  const weekTotal = days.reduce((sum, date) => {
    const { mealsTotal, activeMeals } = buildMeals(date);
    const computed = mealsTotal + delivery * activeMeals;
    const finalAmt = vendorNotesByDate[date]?.finalAmount ?? null;
    return sum + ((finalAmt != null && Math.round(finalAmt) !== Math.round(computed)) ? finalAmt : computed);
  }, 0);
  const expenseTillNow = days.reduce((sum, date) => {
    if (date > today) return sum;
    const { mealsTotal, activeMeals } = buildMeals(date);
    const computed = mealsTotal + delivery * activeMeals;
    const finalAmt = vendorNotesByDate[date]?.finalAmount ?? null;
    return sum + ((finalAmt != null && Math.round(finalAmt) !== Math.round(computed)) ? finalAmt : computed);
  }, 0);

  // Drift: days already sent whose live total no longer matches what the vendor has.
  const driftDays = days
    .map(date => {
      const sent = sentDayTotal(date);
      if (sent == null) return null;
      const { mealsTotal, activeMeals } = buildMeals(date);
      const live = mealsTotal + delivery * activeMeals;
      if (Math.round(sent) === Math.round(live)) return null;
      return { date, delta: live - sent };
    })
    .filter((x): x is { date: string; delta: number } => x !== null);
  const sentWeekTotal = days.reduce((sum, date) => sum + (sentDayTotal(date) ?? 0), 0);
  const driftTotal = driftDays.reduce((s, x) => s + x.delta, 0);

  const remindMeal = async (mealType: MealType) => {
    setRemindPending(true);
    try {
      const res = await gqlRequest<{ remindNotEaten: number }>(REMIND_NOT_EATEN, { date: today, mealType });
      const n = res.remindNotEaten ?? 0;
      const label = mealType.charAt(0).toUpperCase() + mealType.slice(1);
      toast.show(
        n > 0 ? `${label} reminder sent to ${n} ${n === 1 ? 'person' : 'people'}.` : `Nobody to remind — everyone logged ${label.toLowerCase()}.`,
        n > 0 ? 'success' : 'info',
      );
    } catch (e) {
      toast.show((e as Error).message, 'error');
    } finally {
      setRemindPending(false);
    }
  };

  const promptRemind = () => {
    Alert.alert("Remind who hasn't eaten", 'Send a reminder for which meal today?', [
      { text: 'Breakfast', onPress: () => remindMeal('breakfast') },
      { text: 'Lunch', onPress: () => remindMeal('lunch') },
      { text: 'Dinner', onPress: () => remindMeal('dinner') },
    ]);
  };

  return (
    <Screen
      title="Week"
      subtitle="Combined user selections"
      headerRight={
        <View style={styles.headerActions}>
          <Pressable
            onPress={promptRemind}
            disabled={remindPending}
            hitSlop={8}
            accessibilityLabel="Remind users to update today's eaten status"
            style={styles.bellBtn}>
            <Text style={[styles.bellIcon, remindPending && styles.bellIconBusy]}>🔔</Text>
          </Pressable>
          <SignOutButton />
        </View>
      }
      refreshing={loading}
      onRefresh={load}>
      {/* Settings (collapsible) */}
      <Card padded>
        <Pressable onPress={() => setSettingsOpen(!settingsOpen)} style={styles.settingsHeader}>
          <Text style={styles.settingsTitle}>Settings</Text>
          <Text style={styles.settingsSummary}>
            Cap: {settings.monthlyMealCap != null ? `₹${settings.monthlyMealCap}/mo` : 'None'} · Delivery: {settings.deliveryCharge != null ? `₹${settings.deliveryCharge}/meal` : 'None'} {settingsOpen ? '▴' : '▾'}
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
            <SectionLabel>Delivery Charge (per meal)</SectionLabel>
            {!deliveryEditing ? (
              <View style={styles.settingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingValue}>
                    {settings.deliveryCharge != null ? `₹${settings.deliveryCharge}/meal` : 'No charge set'}
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

            {/* Auto-import (test utility) */}
            <SectionLabel>Weekly auto-import (test)</SectionLabel>
            <Text style={styles.autoImportHint}>
              Runs the Saturday auto-import into the viewed week for all users — copies each user's prior week into empty slots only.
            </Text>
            <Button
              title={autoImporting ? 'Running…' : '↻ Run auto-import now'}
              variant="outline"
              onPress={handleRunAutoImport}
              loading={autoImporting}
              fullWidth
            />
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
          {sentWeekTotal > 0 && (
            <Text style={styles.sentHint}>Sent to shefs: ₹{Math.round(sentWeekTotal)}</Text>
          )}
        </View>
        <Pressable style={styles.navBtn} onPress={() => setWkStart(addDays(wkStart, 7))} hitSlop={8}>
          <Text style={styles.navBtnText}>›</Text>
        </Pressable>
      </View>

      {driftDays.length > 0 && (
        <View style={styles.driftBanner}>
          <Text style={styles.driftBannerText}>
            ⚠ {driftDays.length} day{driftDays.length === 1 ? '' : 's'} changed after you sent to shefs (
            {driftTotal >= 0 ? '+' : '−'}₹{Math.abs(Math.round(driftTotal))}). The vendor still has the amount you
            sent — re-send to bring them in sync.
          </Text>
        </View>
      )}

      {/* Send to Shefs */}
      <Button
        title={weekConfirming ? (weekProgress || 'Sending…') : 'Send to Shefs…'}
        icon="✓"
        onPress={handleConfirmWeek}
        loading={weekConfirming}
        disabled={writeBusy}
        fullWidth
      />

      {loading && Object.keys(aggByKey).length === 0 ? (
        <Loader label="Loading week…" />
      ) : (
        days.map(date => {
          const { meals, subtotals, cancelled, mealsTotal, activeMeals } = buildMeals(date);
          const deliveryTotal = delivery * activeMeals;
          const dayTotal = mealsTotal + deliveryTotal;
          const collapsed = collapsedDays.has(date);
          const vendorNote = vendorNotesByDate[date];
          const finalAmt = vendorNote?.finalAmount ?? undefined;
          // Only strike through when the vendor's final differs from the computed total.
          const showFinal = finalAmt != null && Math.round(finalAmt) !== Math.round(dayTotal);
          const sentTotal = sentDayTotal(date);
          const drifted = sentTotal != null && Math.round(sentTotal) !== Math.round(dayTotal);

          return (
            <Card key={date} padded={false}>
              <Pressable onPress={() => toggleDayCollapse(date)} style={styles.dayHeader}>
                <View style={styles.dayHeaderLeft}>
                  <Text style={[styles.chevron, collapsed && styles.chevronCollapsed]}>▾</Text>
                  <Text style={styles.dayTitle}>{dayName(date)} · {formatShort(date)}</Text>
                  {isToday(date) && <Text style={styles.todayBadge}>Today</Text>}
                  {drifted && <Text style={styles.driftTag}>⚠ changed</Text>}
                </View>
                <View style={styles.amountCol}>
                  {showFinal ? (
                    <View style={styles.amountWrap}>
                      <Text style={styles.dayAmountStruck}>₹{Math.round(dayTotal)}</Text>
                      <Text style={styles.dayAmount}>₹{finalAmt}</Text>
                    </View>
                  ) : (
                    <Text style={styles.dayAmount}>₹{Math.round(dayTotal)}</Text>
                  )}
                  {drifted && <Text style={styles.driftSent}>sent ₹{Math.round(sentTotal!)}</Text>}
                </View>
              </Pressable>

              {collapsed ? (
                (vendorNote?.comment || vendorNote?.adminComment) ? (
                  <View style={styles.collapsedComment}>
                    {vendorNote?.comment ? (
                      <Text style={styles.collapsedCommentText}>Vendor: {vendorNote.comment}</Text>
                    ) : null}
                    {vendorNote?.adminComment ? (
                      <Text style={styles.collapsedCommentText}>Admin: {vendorNote.adminComment}</Text>
                    ) : null}
                  </View>
                ) : null
              ) : (
                <View style={styles.body}>
                  {MEAL_TYPES.map(meal => {
                    const rows = meals[meal];
                    const isCancelled = cancelled[meal];
                    const isEditing = editing?.date === date && editing?.meal === meal;
                    return (
                      <View key={meal} style={[styles.mealGroup, isCancelled && styles.mealGroupCancelled]}>
                        <View style={styles.mealHeadRow}>
                          <Text style={[styles.mealLabel, isCancelled && styles.mealLabelCancelled]}>
                            {mealMeta[meal].icon} {mealMeta[meal].label}
                          </Text>
                          <View style={styles.mealActions}>
                            {!isCancelled && !isEditing && (
                              <Pressable onPress={() => openEdit(date, meal)} hitSlop={6} style={styles.editBtn}>
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
                          <View style={styles.cancelledCard}>
                            <Text style={styles.cancelledEmoji}>👨‍🍳</Text>
                            <Text style={styles.cancelledNote}>Cancelled — kitchen closed</Text>
                          </View>
                        ) : isEditing ? (
                          <View style={styles.editForm}>
                            <Text style={styles.editHint}>Overwrite a user's picks for {mealMeta[meal].label.toLowerCase()}:</Text>
                            <View style={styles.userPickerWrap}>
                              {users.map(u => (
                                <Pressable
                                  key={u._id}
                                  onPress={() => pickEditUser(u._id)}
                                  style={[styles.userOption, editUserId === u._id && styles.userOptionSelected]}>
                                  <Text style={[styles.userOptionText, editUserId === u._id && styles.userOptionTextSelected]} numberOfLines={1}>{u.name}</Text>
                                </Pressable>
                              ))}
                            </View>
                            {editUserId !== '' && (
                              <>
                                {Object.keys(editItems).length === 0 && (
                                  <Text style={styles.editHint}>No dishes yet — add one below.</Text>
                                )}
                                {Object.entries(editItems).map(([mid, qty]) => (
                                  <View key={mid} style={styles.editRow}>
                                    <Text style={styles.editItemName} numberOfLines={1}>{menuById.get(mid)?.name ?? 'Item'}</Text>
                                    <TextInput
                                      style={styles.editQtyInput}
                                      value={qty}
                                      onChangeText={(v) => setEditItems(prev => ({ ...prev, [mid]: sanitizeQty(v) }))}
                                      keyboardType="decimal-pad"
                                    />
                                    <Text style={styles.editUnit}>{menuById.get(mid)?.unit ?? ''}</Text>
                                  </View>
                                ))}
                                <View style={styles.userPickerWrap}>
                                  {menuByMeal[meal]
                                    .filter(mi => !(parseFloat(editItems[mi._id]) > 0))
                                    .map(mi => (
                                      <Pressable
                                        key={mi._id}
                                        onPress={() => setEditItems(prev => ({ ...prev, [mi._id]: parseFloat(prev[mi._id]) > 0 ? prev[mi._id] : '1' }))}
                                        style={styles.addItemOption}>
                                        <Text style={styles.addItemOptionText} numberOfLines={1}>
                                          + {mi.name}{mi.pricePerUnit != null ? ` · ₹${mi.pricePerUnit}` : ''}
                                        </Text>
                                      </Pressable>
                                    ))}
                                </View>
                                <Text style={styles.editHint}>Set a dish to 0 to remove it. Saving overwrites this user's selection.</Text>
                              </>
                            )}
                            <View style={styles.editActions}>
                              <Button title={editSaving ? '…' : 'Save'} onPress={handleSaveUserSelection} loading={editSaving} disabled={!editUserId} />
                              <Button title="Cancel" variant="outline" onPress={() => setEditing(null)} />
                            </View>
                          </View>
                        ) : rows.length === 0 ? (
                          <Text style={styles.emptyRow}>No selections</Text>
                        ) : (
                          <>
                            <View style={styles.rowHead}>
                              <Text style={[styles.colItem, styles.headText]}>Item</Text>
                              <Text style={[styles.colQty, styles.headText]}>Qty</Text>
                              <Text style={[styles.colPrice, styles.headText]}>Price</Text>
                              <Text style={[styles.colAmt, styles.headText]}>Amount</Text>
                            </View>
                            {rows.map((r, i) => (
                              <View key={`${meal}-${i}`} style={styles.itemBlock}>
                                <View style={styles.itemRowInner}>
                                  <Text style={styles.colItem} numberOfLines={1}>{r.name}</Text>
                                  <Text style={styles.colQty}>{r.qty}</Text>
                                  <Text style={styles.colPrice}>{r.unitPrice}</Text>
                                  <Text style={styles.colAmt}>{Math.round(r.amount)}</Text>
                                </View>
                                <WhoChose breakdown={r.personBreakdown} />
                              </View>
                            ))}
                            <View style={styles.subtotalRow}>
                              <Text style={styles.subtotalLabel}>Subtotal</Text>
                              <Text style={styles.subtotalValue}>₹{Math.round(subtotals[meal])}</Text>
                            </View>
                          </>
                        )}
                      </View>
                    );
                  })}
                  <View style={styles.dayFooter}>
                    <View style={styles.footerLine}>
                      <Text style={styles.footerLabel}>Delivery{deliveryTotal > 0 ? ` (${activeMeals} × ₹${Math.round(delivery)})` : ''}</Text>
                      <Text style={styles.footerValue}>{deliveryTotal > 0 ? `₹${Math.round(deliveryTotal)}` : '—'}</Text>
                    </View>
                    <View style={styles.footerLine}>
                      <Text style={styles.footerTotalLabel}>Day total</Text>
                      {showFinal ? (
                        <View style={styles.amountWrap}>
                          <Text style={styles.footerTotalStruck}>₹{Math.round(dayTotal)}</Text>
                          <Text style={styles.footerTotalValue}>₹{finalAmt}</Text>
                        </View>
                      ) : (
                        <Text style={styles.footerTotalValue}>₹{Math.round(dayTotal)}</Text>
                      )}
                    </View>
                  </View>
                  {/* Comments: vendor's note + admin's own comment / reply */}
                  <View style={styles.commentsWrap}>
                    {vendorNote?.comment ? (
                      <View style={styles.commentBlock}>
                        <Text style={styles.commentAuthor}>Vendor</Text>
                        <Text style={styles.commentBody}>{vendorNote.comment}</Text>
                      </View>
                    ) : null}

                    {commentEditDay === date ? (
                      <View style={styles.commentEditBox}>
                        <TextInput
                          style={styles.commentInput}
                          value={commentDraft}
                          onChangeText={setCommentDraft}
                          placeholder={vendorNote?.comment ? 'Reply to the vendor…' : 'Add a comment…'}
                          placeholderTextColor={colors.textFaint}
                          multiline
                        />
                        <View style={styles.commentEditActions}>
                          <Button title={commentSaving ? 'Saving…' : 'Save'} onPress={() => saveAdminComment(date)} loading={commentSaving} />
                          <Button title="Cancel" variant="outline" onPress={() => setCommentEditDay(null)} />
                        </View>
                      </View>
                    ) : (
                      <View style={styles.commentRow}>
                        <View style={{ flex: 1 }}>
                          {vendorNote?.adminComment ? (
                            <View style={styles.commentBlock}>
                              <Text style={styles.commentAuthorAdmin}>Admin</Text>
                              <Text style={styles.commentBody}>{vendorNote.adminComment}</Text>
                            </View>
                          ) : null}
                        </View>
                        <Pressable onPress={() => openCommentEdit(date)} hitSlop={6} style={styles.commentBtn}>
                          <Text style={styles.commentBtnText}>
                            {vendorNote?.adminComment ? 'Edit' : vendorNote?.comment ? 'Reply' : 'Comment'}
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sentHint: { color: colors.textFaint, fontSize: font.tiny, marginTop: 1 },
  driftBanner: {
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.45)',
    backgroundColor: 'rgba(245,158,11,0.12)',
  },
  driftBannerText: { color: colors.warning, fontSize: font.small, lineHeight: 19 },
  driftTag: { color: colors.warning, fontSize: font.tiny, fontWeight: '700' },
  driftSent: { color: colors.warning, fontSize: font.tiny, marginTop: 1, textAlign: 'right' },
  amountCol: { alignItems: 'flex-end' },
  bellBtn: { padding: 2 },
  bellIcon: { fontSize: 20 },
  bellIconBusy: { opacity: 0.5 },
  settingsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingsTitle: { color: colors.text, fontSize: font.body, fontWeight: '700' },
  settingsSummary: { color: colors.textMuted, fontSize: font.tiny },
  settingsBody: { marginTop: spacing.md },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingValue: { color: colors.text, fontSize: 18, fontWeight: '800' },
  settingEditRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  autoImportHint: { color: colors.textMuted, fontSize: font.tiny, marginBottom: spacing.sm },
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
  amountWrap: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  dayAmountStruck: {
    color: colors.textFaint,
    fontSize: font.small,
    fontWeight: '600',
    textDecorationLine: 'line-through',
  },
  footerTotalStruck: {
    color: colors.textFaint,
    fontSize: font.small,
    fontWeight: '600',
    textDecorationLine: 'line-through',
  },
  collapsedComment: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  collapsedCommentText: { color: colors.textMuted, fontSize: font.small, fontStyle: 'italic' },

  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  emptyRow: { color: colors.textFaint, fontStyle: 'italic', fontSize: font.small },

  mealGroup: { marginTop: spacing.md },
  mealGroupCancelled: { opacity: 0.6 },
  mealHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  mealActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  editBtn: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.bgElevated, alignItems: 'center', justifyContent: 'center',
  },
  editBtnText: { fontSize: 13 },
  editForm: { gap: spacing.sm, marginTop: spacing.xs },
  editHint: { color: colors.textMuted, fontSize: font.tiny },
  userPickerWrap: { gap: 4 },
  userOption: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  userOptionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  userOptionText: { color: colors.text, fontSize: font.small },
  userOptionTextSelected: { color: colors.primary, fontWeight: '700' },
  addItemOption: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  addItemOptionText: { color: colors.text, fontSize: font.small },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  editItemName: { flex: 1, fontSize: font.small, fontWeight: '500', color: colors.text },
  editQtyInput: {
    width: 54, paddingVertical: 4, paddingHorizontal: 6, borderRadius: radius.sm, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.bgElevated, color: colors.text, fontSize: font.small, textAlign: 'center',
  },
  editUnit: { fontSize: font.tiny, color: colors.textMuted, minWidth: 28 },
  editActions: { flexDirection: 'row', gap: spacing.sm },
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
  cancelledCard: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  cancelledEmoji: { fontSize: 56, lineHeight: 64 },
  cancelledNote: { color: colors.danger, fontSize: font.small, fontWeight: '700' },
  rowHead: { flexDirection: 'row', paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: colors.border },
  headText: { color: colors.textFaint, fontSize: font.tiny, fontWeight: '700' },
  itemBlock: { paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: colors.border },
  itemRowInner: { flexDirection: 'row' },
  whoWrap: { marginTop: 2 },
  whoToggle: { color: colors.textMuted, fontSize: font.tiny, fontWeight: '600' },
  whoGroupLine: { color: colors.textMuted, fontSize: font.tiny, marginTop: 1, marginLeft: 2 },
  whoQty: { color: colors.text, fontWeight: '700' },
  colItem: { flex: 1, color: colors.text, fontSize: font.small },
  colQty: { width: 40, textAlign: 'right', color: colors.text, fontSize: font.small },
  colPrice: { width: 56, textAlign: 'right', color: colors.textMuted, fontSize: font.small },
  colAmt: { width: 64, textAlign: 'right', color: colors.text, fontSize: font.small, fontWeight: '600' },
  subtotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 5 },
  subtotalLabel: { color: colors.textMuted, fontSize: font.small, fontWeight: '700' },
  subtotalValue: { color: colors.text, fontSize: font.small, fontWeight: '700' },

  commentsWrap: { marginTop: spacing.md, gap: spacing.sm },
  commentBlock: { gap: 1 },
  commentAuthor: { color: colors.textFaint, fontSize: font.tiny, fontWeight: '700' },
  commentAuthorAdmin: { color: colors.primary, fontSize: font.tiny, fontWeight: '700' },
  commentBody: { color: colors.textMuted, fontSize: font.small, fontStyle: 'italic' },
  commentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  commentBtn: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: colors.bgElevated },
  commentBtnText: { color: colors.primary, fontSize: font.tiny, fontWeight: '700' },
  commentEditBox: {
    padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface,
  },
  commentInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: 6, paddingHorizontal: 10,
    color: colors.text, fontSize: font.small, minHeight: 50, textAlignVertical: 'top',
  },
  commentEditActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },

  dayFooter: { marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  footerLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  footerLabel: { color: colors.textMuted, fontSize: font.small },
  footerValue: { color: colors.text, fontSize: font.small, fontWeight: '600' },
  footerTotalLabel: { color: colors.text, fontSize: font.body, fontWeight: '800' },
  footerTotalValue: { color: colors.primary, fontSize: font.body, fontWeight: '800' },
});
