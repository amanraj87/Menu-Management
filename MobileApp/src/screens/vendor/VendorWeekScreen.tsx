import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Share from 'react-native-share';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { buildVendorWeekXlsxBase64, type ExportDay } from '../../utils/vendorWeekExport';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../ui/Screen';
import { Button, Card, Loader } from '../../ui';
import { SignOutButton } from '../../ui/SignOutButton';
import { gqlRequest } from '../../api/client';
import { CONFIRMED_ORDERS_FOR_RANGE, UPDATE_VENDOR_DAY_NOTE } from '../../api/operations';
import { useMenuItems, useSettings, useMealCancellationsForRange, useVendorDayNotesForRange } from '../../api/hooks';
import { useToast } from '../../context/ToastContext';
import { colors, font, mealMeta, radius, spacing } from '../../theme';
import { addDays, formatShort, isToday, todayISO, weekStart as getWeekStart } from '../../utils/date';
import { MEAL_TYPES, type ConfirmedOrder, type MealType } from '../../types';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function dayName(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return DAY_NAMES[new Date(y, m - 1, d).getDay()];
}

type Row = { name: string; unit: string; qty: number; unitPrice: number; amount: number };

export function VendorWeekScreen() {
  const toast = useToast();
  const [wkStart, setWkStart] = useState(() => getWeekStart(todayISO()));
  const [ordersByDate, setOrdersByDate] = useState<Record<string, ConfirmedOrder[]>>({});
  const [loading, setLoading] = useState(true);

  const menu = useMenuItems();
  const { settings } = useSettings();
  const delivery = settings.deliveryCharge ?? 0;

  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [draftAmount, setDraftAmount] = useState('');
  const [draftComment, setDraftComment] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(wkStart, i)),
    [wkStart],
  );
  const wkEnd = addDays(wkStart, 6);

  const { cancellations } = useMealCancellationsForRange(wkStart, wkEnd);
  const cancelledSet = useMemo(() => {
    const s = new Set<string>();
    cancellations.forEach(c => s.add(`${c.date}|${c.mealType}`));
    return s;
  }, [cancellations]);

  const { notes, refetch: refetchNotes } = useVendorDayNotesForRange(wkStart, wkEnd);
  const notesByDate = useMemo(() => {
    const map: Record<string, { finalAmount: number | null; comment: string }> = {};
    notes.forEach(n => { map[n.date] = { finalAmount: n.finalAmount, comment: n.comment }; });
    return map;
  }, [notes]);

  const openEdit = (date: string, calcTotal: number) => {
    const existing = notesByDate[date];
    setDraftAmount(existing?.finalAmount != null ? String(existing.finalAmount) : String(Math.round(calcTotal)));
    setDraftComment(existing?.comment ?? '');
    setEditingDay(date);
  };

  const saveNote = async (date: string) => {
    const amt = draftAmount.trim() === '' ? null : Number(draftAmount);
    if (amt != null && isNaN(amt)) { toast.show('Amount must be a number', 'error'); return; }
    setNoteSaving(true);
    try {
      await gqlRequest(UPDATE_VENDOR_DAY_NOTE, { date, finalAmount: amt, comment: draftComment.trim() });
      await refetchNotes();
      setEditingDay(null);
    } catch (e) {
      toast.show((e as Error).message, 'error');
    } finally {
      setNoteSaving(false);
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

  const priceMap = useMemo(() => {
    const m = new Map<string, number>();
    menu.items.forEach(i => m.set(i._id, i.pricePerUnit ?? 0));
    return m;
  }, [menu.items]);

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
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [wkStart, wkEnd]);

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
        meals[o.mealType].push({ name: it.name, unit: it.unit, qty: it.quantity, unitPrice, amount });
        subtotals[o.mealType] += amount;
      });
    });
    const mealsTotal = MEAL_TYPES.reduce((s, m) => s + (cancelled[m] ? 0 : subtotals[m]), 0);
    // Delivery is charged per active meal (has an order and not cancelled).
    const activeMeals = MEAL_TYPES.filter(m => !cancelled[m] && subtotals[m] > 0).length;
    return { meals, subtotals, cancelled, mealsTotal, activeMeals };
  };

  const today = todayISO();
  const calcDayTotal = (date: string) => {
    const { mealsTotal, activeMeals } = buildMeals(date, ordersByDate[date] ?? []);
    return mealsTotal + delivery * activeMeals;
  };
  const effectiveDayTotal = (date: string) => notesByDate[date]?.finalAmount ?? calcDayTotal(date);
  const weekTotal = days.reduce((sum, date) => sum + effectiveDayTotal(date), 0);
  const expenseTillNow = days.reduce((sum, date) => sum + (date <= today ? effectiveDayTotal(date) : 0), 0);

  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    setExporting(true);
    try {
      const exportDays: ExportDay[] = days.map(date => {
        const { meals, subtotals, cancelled, activeMeals } = buildMeals(date, ordersByDate[date] ?? []);
        const [yy, mm, dd] = date.split('-');
        const mapRows = (meal: MealType) =>
          meals[meal].map(r => ({ name: r.name, qty: r.qty, unitPrice: Math.round(r.unitPrice), amount: Math.round(r.amount) }));
        return {
          date: `${Number(dd)}/${Number(mm)}/${yy}`,
          day: dayName(date),
          breakfast: mapRows('breakfast'),
          lunch: mapRows('lunch'),
          dinner: mapRows('dinner'),
          cancelled,
          subtotals: {
            breakfast: Math.round(subtotals.breakfast),
            lunch: Math.round(subtotals.lunch),
            dinner: Math.round(subtotals.dinner),
          },
          delivery: Math.round(delivery * activeMeals),
          dayTotal: Math.round(effectiveDayTotal(date)),
        };
      });
      const base64 = buildVendorWeekXlsxBase64(exportDays);
      // Write to a real file, then share its path — react-native-share converts
      // the file:// path to a content:// URI via its FileProvider. Sharing a raw
      // base64 data URI crashes on Android (null Uri.getScheme()).
      const path = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/vendor-week-${wkStart}.xlsx`;
      await ReactNativeBlobUtil.fs.writeFile(path, base64, 'base64');
      await Share.open({
        title: `Vendor week ${wkStart} – ${wkEnd}`,
        filename: `vendor-week-${wkStart}.xlsx`,
        type: XLSX_MIME,
        url: `file://${path}`,
        failOnCancel: false,
      });
    } catch (e) {
      const msg = (e as Error).message;
      if (msg && !/cancel/i.test(msg)) toast.show(msg, 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Screen
      title="Week — order sheet"
      subtitle="Confirmed orders, priced like your billing sheet"
      headerRight={<SignOutButton />}
      refreshing={loading}
      onRefresh={load}>
      {/* Week nav */}
      <View style={styles.weekNav}>
        <Pressable style={styles.navBtn} onPress={() => setWkStart(addDays(wkStart, -7))} hitSlop={8}>
          <Text style={styles.navBtnText}>‹</Text>
        </Pressable>
        <View style={styles.weekLabelWrap}>
          <Text style={styles.weekLabel}>{formatShort(wkStart)} – {formatShort(wkEnd)}</Text>
          <Text style={styles.weekExpense}>₹{Math.round(expenseTillNow)} <Text style={styles.weekExpenseMuted}>/ ₹{Math.round(weekTotal)}</Text></Text>
          <Text style={styles.weekExpenseHint}>spent till now / week total</Text>
        </View>
        <Pressable style={styles.navBtn} onPress={() => setWkStart(addDays(wkStart, 7))} hitSlop={8}>
          <Text style={styles.navBtnText}>›</Text>
        </Pressable>
      </View>

      <Button
        title="↻ Refresh orders"
        variant="outline"
        onPress={load}
        loading={loading}
        fullWidth
      />
      <Button
        title={exporting ? 'Exporting…' : '⬇ Export to Excel'}
        variant="outline"
        onPress={handleExport}
        loading={exporting}
        fullWidth
      />

      {loading && Object.keys(ordersByDate).length === 0 ? (
        <Loader label="Loading week…" />
      ) : (
        days.map(date => {
          const orders = ordersByDate[date] ?? [];
          const { meals, subtotals, cancelled, mealsTotal, activeMeals } = buildMeals(date, orders);
          const deliveryTotal = delivery * activeMeals;
          const calcTotal = mealsTotal + deliveryTotal;
          const dayTotal = effectiveDayTotal(date);
          const note = notesByDate[date];
          const hasOverride = note?.finalAmount != null;
          const isEditing = editingDay === date;
          const collapsed = collapsedDays.has(date);

          return (
            <Card key={date} padded={false}>
              <Pressable onPress={() => toggleDayCollapse(date)} style={styles.dayHeader}>
                <View style={styles.dayHeaderLeft}>
                  <Text style={[styles.chevron, collapsed && styles.chevronCollapsed]}>▾</Text>
                  <Text style={styles.dayTitle}>{dayName(date)} · {formatShort(date)}</Text>
                  {isToday(date) && <Text style={styles.todayBadge}>Today</Text>}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.dayAmount, hasOverride && { color: colors.primary }]}>₹{Math.round(dayTotal)}</Text>
                  {hasOverride && <Text style={styles.overrideHint}>calc: ₹{Math.round(calcTotal)}</Text>}
                </View>
              </Pressable>

              {collapsed ? (
                note?.comment ? (
                  <View style={styles.collapsedComment}>
                    <Text style={styles.collapsedCommentText}>{note.comment}</Text>
                  </View>
                ) : null
              ) : (
                <View style={styles.body}>
                  {MEAL_TYPES.map(meal => {
                    const rows = meals[meal];
                    const isCancelled = cancelled[meal];
                    return (
                      <View key={meal} style={[styles.mealGroup, isCancelled && styles.mealGroupCancelled]}>
                        <View style={styles.mealHeadRow}>
                          <Text style={[styles.mealLabel, isCancelled && styles.mealLabelCancelled]}>
                            {mealMeta[meal].icon} {mealMeta[meal].label}
                          </Text>
                          {isCancelled && (
                            <Text style={styles.cancelledLabel}>Cancelled</Text>
                          )}
                        </View>
                        {isCancelled ? (
                          <View style={styles.cancelledCard}>
                            <Text style={styles.cancelledEmoji}>👨‍🍳</Text>
                            <Text style={styles.cancelledNote}>Cancelled — kitchen closed</Text>
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
                      </View>
                    );
                  })}
                  {/* Delivery + day total */}
                  <View style={styles.dayFooter}>
                    <View style={styles.footerLine}>
                      <Text style={styles.footerLabel}>Delivery{deliveryTotal > 0 ? ` (${activeMeals} × ₹${Math.round(delivery)})` : ''}</Text>
                      <Text style={styles.footerValue}>{deliveryTotal > 0 ? `₹${Math.round(deliveryTotal)}` : '—'}</Text>
                    </View>
                    <View style={styles.footerLine}>
                      <Text style={styles.footerTotalLabel}>Day total</Text>
                      <Text style={styles.footerTotalValue}>₹{Math.round(calcTotal)}</Text>
                    </View>
                  </View>

                  {/* Final amount & comment */}
                  {isEditing ? (
                    <View style={styles.editBox}>
                      <View style={styles.editRow}>
                        <Text style={styles.editLabel}>Final amount</Text>
                        <TextInput
                          style={styles.editInput}
                          value={draftAmount}
                          onChangeText={setDraftAmount}
                          keyboardType="numeric"
                          placeholder="₹"
                          placeholderTextColor={colors.textFaint}
                        />
                      </View>
                      <TextInput
                        style={styles.commentInput}
                        value={draftComment}
                        onChangeText={setDraftComment}
                        placeholder="Add a comment…"
                        placeholderTextColor={colors.textFaint}
                        multiline
                      />
                      <View style={styles.editActions}>
                        <Button title={noteSaving ? 'Saving…' : 'Save'} onPress={() => saveNote(date)} loading={noteSaving} />
                        <Button title="Cancel" variant="outline" onPress={() => setEditingDay(null)} />
                      </View>
                    </View>
                  ) : (
                    <View style={styles.noteRow}>
                      <View style={{ flex: 1 }}>
                        {note?.comment ? <Text style={styles.commentText}>{note.comment}</Text> : null}
                        {hasOverride && <Text style={styles.overrideHint}>calc: ₹{Math.round(calcTotal)}</Text>}
                      </View>
                      <Pressable onPress={() => openEdit(date, calcTotal)} hitSlop={6} style={styles.editBtn}>
                        <Text style={styles.editBtnText}>{hasOverride ? 'Edit' : 'Set final amount'}</Text>
                      </Pressable>
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
  weekExpense: { color: colors.primary, fontSize: 18, fontWeight: '800', marginTop: 2 },
  weekExpenseMuted: { color: colors.textMuted, fontSize: font.small, fontWeight: '600' },
  weekExpenseHint: { color: colors.textFaint, fontSize: font.tiny, marginTop: 1 },

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

  mealGroup: { marginTop: spacing.md },
  mealGroupCancelled: { opacity: 0.6 },
  mealHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  mealLabel: { color: colors.textMuted, fontSize: font.small, fontWeight: '700' },
  mealLabelCancelled: { textDecorationLine: 'line-through' },
  cancelledLabel: { color: colors.danger, fontSize: font.tiny, fontWeight: '700' },
  cancelledCard: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  cancelledEmoji: { fontSize: 56, lineHeight: 64 },
  cancelledNote: { color: colors.danger, fontSize: font.small, fontWeight: '700' },
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

  editBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  editLabel: { color: colors.text, fontSize: font.small, fontWeight: '600' },
  editInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
    color: colors.text,
    fontSize: font.body,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
    color: colors.text,
    fontSize: font.small,
    minHeight: 50,
    textAlignVertical: 'top',
  },
  editActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  commentText: { color: colors.textMuted, fontSize: font.small, fontStyle: 'italic' },
  overrideHint: { color: colors.textFaint, fontSize: font.tiny, marginTop: 2 },
  editBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.bgElevated,
  },
  editBtnText: { color: colors.primary, fontSize: font.tiny, fontWeight: '700' },

  dayFooter: { marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  footerLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  footerLabel: { color: colors.textMuted, fontSize: font.small },
  footerValue: { color: colors.text, fontSize: font.small, fontWeight: '600' },
  footerTotalLabel: { color: colors.text, fontSize: font.body, fontWeight: '800' },
  footerTotalValue: { color: colors.primary, fontSize: font.body, fontWeight: '800' },
});
