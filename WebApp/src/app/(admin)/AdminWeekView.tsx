import { useMemo, useState } from 'react'
import { useApolloClient } from '@apollo/client/react'
import {
  useAggregatedOrdersForRange,
  useConfirmedOrdersForRange,
  useMenuItems,
  useUsers,
  useSettings,
  useUpdateSettings,
  useMealCancellationsForRange,
  useToggleMealCancellation,
  useVendorDayNotesForRange,
  useUpdateAdminDayComment,
} from '@/shared/graphql/hooks'
import { CONFIRM_ORDER_WITH_ITEMS, AGGREGATED_ORDERS_FOR_RANGE, ADMIN_SET_USER_SELECTION, RUN_AUTO_IMPORT, NOTIFY_ORDERS_SENT_TO_VENDOR } from '@/shared/graphql/operations'
import { Card, Button, Loader } from '@/shared/ui'
import { useToastStore } from '@/shared/stores/toastStore'
import type { MealType } from '@/shared/types'

function toDateString(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return toDateString(d)
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return toDateString(d)
}

function dayName(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString(undefined, { weekday: 'long' })
}

function shortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

function money(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

/** Keep only digits and a single decimal point so qty inputs accept floats. */
function sanitizeQty(v: string): string {
  let s = v.replace(/[^0-9.]/g, '')
  const dot = s.indexOf('.')
  if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '')
  return s
}

const MEALS: { id: Meal; label: string; icon: string }[] = [
  { id: 'breakfast', label: 'Breakfast', icon: '🌅' },
  { id: 'lunch', label: 'Lunch', icon: '☀️' },
  { id: 'dinner', label: 'Dinner', icon: '🌙' },
]
type Meal = 'breakfast' | 'lunch' | 'dinner'

type PersonShare = { userId: string; userName: string; quantity: number }
type Row = { menuItemId: string; name: string; unit: string; qty: number; unitPrice: number; amount: number; personBreakdown: PersonShare[] }
type DayData = {
  date: string
  meals: Record<Meal, Row[]>
  subtotals: Record<Meal, number>
  cancelled: Record<Meal, boolean>
  mealsTotal: number
}

/** Collapsible "who chose this" list, grouped by quantity (same qty on one line). */
function WhoChose({ breakdown }: { breakdown: PersonShare[] }) {
  const [open, setOpen] = useState(false)
  if (breakdown.length === 0) return null
  const byQty = new Map<number, string[]>()
  for (const p of breakdown) {
    if (!byQty.has(p.quantity)) byQty.set(p.quantity, [])
    byQty.get(p.quantity)!.push(p.userName)
  }
  const groups = Array.from(byQty.entries()).sort((a, b) => b[0] - a[0])
  const total = breakdown.length
  return (
    <div style={{ marginTop: '0.15rem' }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}
      >
        👤 {total} {total === 1 ? 'person' : 'people'}
        <span style={{ display: 'inline-block', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }}>▾</span>
      </button>
      {open && (
        <div style={{ marginTop: '0.15rem', display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
          {groups.map(([qty, names]) => (
            <div key={qty} style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
              <strong style={{ color: 'var(--color-text)' }}>{qty}×</strong> {names.join(', ')}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function isTodayStr(dateStr: string): boolean {
  return dateStr === toDateString(new Date())
}

export function AdminWeekView() {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(toDateString(new Date())))
  const weekEnd = addDays(weekStart, 6)
  const dates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const toast = useToastStore()
  const client = useApolloClient()

  const { aggregated, isLoading: aggLoading } = useAggregatedOrdersForRange(weekStart, weekEnd)
  // What the vendor was actually sent, so we can flag drift since "Send to Shefs".
  const { orders: confirmedOrders } = useConfirmedOrdersForRange(weekStart, weekEnd)
  const { items: menuItems, isLoading: menuLoading } = useMenuItems()
  const { users } = useUsers()
  const { settings, isLoading: settingsLoading } = useSettings()
  const { cancellations, isLoading: cancelLoading, refetch: refetchCancellations } = useMealCancellationsForRange(weekStart, weekEnd)
  const { notes: vendorNotes, isLoading: notesLoading, refetch: refetchNotes } = useVendorDayNotesForRange(weekStart, weekEnd)
  const { update: updateAdminComment, isPending: adminCommentSaving } = useUpdateAdminDayComment()
  const { toggle: toggleCancel, isPending: toggling } = useToggleMealCancellation()
  const { updateSettings, isPending: settingsPending } = useUpdateSettings(
    () => { toast.add('Settings updated.', 'success'); setCapEditing(false); setDeliveryEditing(false) },
    (e) => toast.add(e.message, 'error')
  )

  const [capEditing, setCapEditing] = useState(false)
  const [capInput, setCapInput] = useState('')
  const [deliveryEditing, setDeliveryEditing] = useState(false)
  const [deliveryInput, setDeliveryInput] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [weekPending, setWeekPending] = useState(false)
  const [weekProgress, setWeekProgress] = useState('')
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set())
  const [autoImporting, setAutoImporting] = useState(false)
  // Per-user selection editor (admin overwrites one user's picks for a meal).
  const [editing, setEditing] = useState<{ date: string; meal: Meal } | null>(null)
  const [editUserId, setEditUserId] = useState('')
  // Qty inputs are held as raw strings so decimals (e.g. "0.5") can be typed.
  const [editItems, setEditItems] = useState<Record<string, string>>({})
  const [editAddId, setEditAddId] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const cancelledSet = useMemo(() => {
    const s = new Set<string>()
    for (const c of cancellations) s.add(`${c.date}|${c.mealType}`)
    return s
  }, [cancellations])

  // Live combined user selections keyed by date|meal → (menuItemId → row info).
  const aggByKey = useMemo(() => {
    const map = new Map<string, Map<string, { name: string; unit: string; qty: number; personBreakdown: PersonShare[] }>>()
    for (const a of aggregated) {
      const key = `${a.date}|${a.mealType}`
      const items = new Map<string, { name: string; unit: string; qty: number; personBreakdown: PersonShare[] }>()
      for (const it of a.items) items.set(it.menuItemId, { name: it.name, unit: it.unit, qty: it.quantity, personBreakdown: it.personBreakdown ?? [] })
      map.set(key, items)
    }
    return map
  }, [aggregated])

  const vendorNotesByDate = useMemo(() => {
    const map: Record<string, { finalAmount: number | null; comment: string; adminComment: string }> = {}
    for (const n of vendorNotes) map[n.date] = { finalAmount: n.finalAmount, comment: n.comment, adminComment: n.adminComment }
    return map
  }, [vendorNotes])

  // Admin per-day comment / reply editor.
  const [commentEditDay, setCommentEditDay] = useState<string | null>(null)
  const [commentDraft, setCommentDraft] = useState('')

  const openCommentEdit = (date: string) => {
    setCommentDraft(vendorNotesByDate[date]?.adminComment ?? '')
    setCommentEditDay(date)
  }
  const saveAdminComment = async (date: string) => {
    try {
      await updateAdminComment(date, commentDraft.trim())
      await refetchNotes()
      setCommentEditDay(null)
    } catch (e) {
      toast.add((e as Error).message, 'error')
    }
  }

  const toggleDayCollapse = (date: string) => {
    setCollapsedDays(prev => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  const handleToggleCancel = async (date: string, meal: MealType, currentlyCancelled: boolean) => {
    await toggleCancel(date, meal, !currentlyCancelled)
    await refetchCancellations()
  }

  const priceByMenuId = useMemo(() => {
    const map: Record<string, number> = {}
    for (const m of menuItems) if (m.pricePerUnit != null) map[m._id] = m.pricePerUnit
    return map
  }, [menuItems])

  const menuById = useMemo(() => {
    const map = new Map<string, { name: string; unit: string }>()
    for (const m of menuItems) map.set(m._id, { name: m.name, unit: m.unit })
    return map
  }, [menuItems])

  const menuByMeal = useMemo(() => {
    const map: Record<Meal, typeof menuItems> = { breakfast: [], lunch: [], dinner: [] }
    for (const m of menuItems) if (m.mealType && map[m.mealType as Meal]) map[m.mealType as Meal].push(m)
    return map
  }, [menuItems])

  /** Reconstruct a single user's picks (menuItemId → qty) for a slot from the aggregate. */
  const userSelectionFor = (date: string, meal: Meal, userId: string): Record<string, number> => {
    const out: Record<string, number> = {}
    const agg = aggByKey.get(`${date}|${meal}`)
    if (agg) {
      for (const [menuItemId, info] of agg) {
        const share = info.personBreakdown.find((p) => p.userId === userId)
        if (share) out[menuItemId] = share.quantity
      }
    }
    return out
  }

  const openEdit = (date: string, meal: Meal) => {
    setEditing({ date, meal })
    setEditUserId('')
    setEditItems({})
    setEditAddId('')
  }
  const pickEditUser = (userId: string) => {
    setEditUserId(userId)
    setEditAddId('')
    const sel = editing ? userSelectionFor(editing.date, editing.meal, userId) : {}
    setEditItems(Object.fromEntries(Object.entries(sel).map(([k, v]) => [k, String(v)])))
  }
  const handleSaveUserSelection = async () => {
    if (!editing || !editUserId) return
    const { date, meal } = editing
    const items = Object.entries(editItems)
      .map(([menuItemId, raw]) => ({ menuItemId, quantity: parseFloat(raw) }))
      .filter(({ quantity }) => Number.isFinite(quantity) && quantity > 0)
    setEditSaving(true)
    try {
      await client.mutate({
        mutation: ADMIN_SET_USER_SELECTION,
        variables: { userId: editUserId, date, mealType: meal, items },
      })
      await client.refetchQueries({ include: [AGGREGATED_ORDERS_FOR_RANGE] })
      setEditing(null)
      toast.add('User selection updated.', 'success')
    } catch (e) {
      toast.add((e as Error).message, 'error')
    } finally {
      setEditSaving(false)
    }
  }

  const delivery = settings.deliveryCharge ?? 0

  // Per-meal subtotals of what was actually SENT to the vendor (confirmed_orders).
  // Users can still opt out of an upcoming meal after a send, which moves the live
  // aggregate but not this — so we compare the two and flag the difference.
  const sentByDate = useMemo(() => {
    const map = new Map<string, Record<Meal, number>>()
    for (const o of confirmedOrders) {
      let subs = map.get(o.date)
      if (!subs) { subs = { breakfast: 0, lunch: 0, dinner: 0 }; map.set(o.date, subs) }
      const meal = o.mealType as Meal
      for (const it of o.items) subs[meal] += (priceByMenuId[it.menuItemId] ?? 0) * it.quantity
    }
    return map
  }, [confirmedOrders, priceByMenuId])

  /** date|meal combos that already have a confirmed order (any amount). */
  const sentKeys = useMemo(
    () => new Set(confirmedOrders.map((o) => `${o.date}|${o.mealType}`)),
    [confirmedOrders]
  )

  /** Day total as last sent to the vendor, or null if nothing was sent for that day. */
  const sentDayTotal = (date: string): number | null => {
    const subs = sentByDate.get(date)
    if (!subs) return null
    let mealsTotal = 0
    let activeMeals = 0
    for (const { id: meal } of MEALS) {
      if (cancelledSet.has(`${date}|${meal}`)) continue
      if (subs[meal] <= 0) continue
      mealsTotal += subs[meal]
      activeMeals++
    }
    return mealsTotal + delivery * activeMeals
  }

  const week: DayData[] = useMemo(() => {
    return dates.map((date) => {
      const meals = { breakfast: [] as Row[], lunch: [] as Row[], dinner: [] as Row[] }
      const subtotals = { breakfast: 0, lunch: 0, dinner: 0 }
      const cancelled = {
        breakfast: cancelledSet.has(`${date}|breakfast`),
        lunch: cancelledSet.has(`${date}|lunch`),
        dinner: cancelledSet.has(`${date}|dinner`),
      }
      for (const { id: meal } of MEALS) {
        const agg = aggByKey.get(`${date}|${meal}`)
        if (!agg) continue
        for (const [menuItemId, info] of agg) {
          const unitPrice = priceByMenuId[menuItemId] ?? 0
          const amount = unitPrice * info.qty
          meals[meal].push({ menuItemId, name: info.name, unit: info.unit, qty: info.qty, unitPrice, amount, personBreakdown: info.personBreakdown })
          subtotals[meal] += amount
        }
      }
      const mealsTotal = MEALS.reduce((s, { id: meal }) => s + (cancelled[meal] ? 0 : subtotals[meal]), 0)
      return { date, meals, subtotals, cancelled, mealsTotal }
    })
  }, [dates, aggByKey, priceByMenuId, cancelledSet])

  const handleRunAutoImport = async () => {
    if (autoImporting) return
    setAutoImporting(true)
    try {
      const res = await client.mutate<{ runAutoImport: number }>({
        mutation: RUN_AUTO_IMPORT,
        variables: { targetWeekStart: weekStart },
      })
      const n = res.data?.runAutoImport ?? 0
      await client.refetchQueries({ include: [AGGREGATED_ORDERS_FOR_RANGE] })
      toast.add(`Auto-import created ${n} selection slot${n === 1 ? '' : 's'} for this week.`, n > 0 ? 'success' : 'info')
    } catch (e) {
      toast.add((e as Error).message, 'error')
    } finally {
      setAutoImporting(false)
    }
  }

  /** Push the current combined selections to the vendor (confirmed_orders). */
  const handleConfirmWeek = async () => {
    if (weekPending) return
    const combos = dates.flatMap((d) => MEALS.map((m) => ({ date: d, meal: m.id })))
    setWeekPending(true)
    setWeekProgress('')
    let confirmed = 0
    let skipped = 0
    let frozen = 0
    let done = 0
    const todayLocal = toDateString(new Date())
    try {
      for (const { date: d, meal: m } of combos) {
        const agg = aggByKey.get(`${d}|${m}`)
        const items = agg
          ? Array.from(agg, ([menuItemId, info]) => ({ menuItemId, name: info.name, unit: info.unit, quantity: info.qty }))
          : []
        // A past day that was already sent is what the vendor actually
        // delivered — never overwrite it. (A past day never sent still goes,
        // so a forgotten week can be recorded.)
        if (d < todayLocal && sentKeys.has(`${d}|${m}`)) {
          frozen++
        } else if (items.length === 0 || cancelledSet.has(`${d}|${m}`)) {
          skipped++
        } else {
          await client.mutate({
            mutation: CONFIRM_ORDER_WITH_ITEMS,
            variables: { date: d, mealType: m, items },
          })
          confirmed++
        }
        done++
        setWeekProgress(`Processing ${done}/${combos.length}…`)
      }
      // One push to the vendor for the whole batch (not one per meal).
      // On a weekday, reference just today's date; on the weekend, the week range.
      if (confirmed > 0 && dates.length > 0) {
        const now = new Date()
        const isWeekend = now.getDay() === 0 || now.getDay() === 6
        const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
        await client.mutate({
          mutation: NOTIFY_ORDERS_SENT_TO_VENDOR,
          variables: isWeekend
            ? { startDate: dates[0], endDate: dates[dates.length - 1] }
            : { startDate: localToday, endDate: localToday },
        }).catch(() => {})
      }
      const notes: string[] = []
      if (frozen > 0) notes.push(`${frozen} already-delivered meal${frozen === 1 ? '' : 's'} left untouched`)
      if (skipped > 0) notes.push(`${skipped} with no selections`)
      const suffix = notes.length > 0 ? ` (${notes.join('; ')}).` : ''
      toast.add(
        confirmed > 0
          ? `Sent ${confirmed} meal${confirmed === 1 ? '' : 's'} to the kitchen.${suffix}`
          : `No new selections to send.${suffix}`,
        confirmed > 0 ? 'success' : 'info'
      )
    } catch (e) {
      toast.add((e as Error).message, 'error')
    } finally {
      setWeekPending(false)
      setWeekProgress('')
    }
  }

  const isLoading = aggLoading || menuLoading || settingsLoading || cancelLoading || notesLoading
  if (isLoading) return <Loader />

  const todayStr = toDateString(new Date())
  // Delivery is charged per active meal (has an order and not cancelled), so a
  // cancelled/empty meal drops its share of the delivery fee.
  const activeMealsOf = (d: DayData) => MEALS.filter(({ id }) => !d.cancelled[id] && d.subtotals[id] > 0).length
  const deliveryOf = (d: DayData) => delivery * activeMealsOf(d)
  const dayTotalOf = (d: DayData) => d.mealsTotal + deliveryOf(d)
  // Use vendor's final amount when it differs from computed total, otherwise use computed.
  const effectiveDayTotal = (d: DayData) => {
    const computed = dayTotalOf(d)
    const finalAmt = vendorNotesByDate[d.date]?.finalAmount ?? null
    return (finalAmt != null && Math.round(finalAmt) !== Math.round(computed)) ? finalAmt : computed
  }
  const weekTotal = week.reduce((sum, d) => sum + effectiveDayTotal(d), 0)
  const expenseTillNow = week.reduce((sum, d) => sum + (d.date <= todayStr ? effectiveDayTotal(d) : 0), 0)

  // Drift: days already sent to the vendor whose live total no longer matches.
  // Only today/future days are actionable — a past day was already delivered
  // against its snapshot and is now frozen, so re-sending can't reconcile it.
  const driftDays = week
    .map((d) => {
      const sent = sentDayTotal(d.date)
      if (sent == null) return null
      const live = dayTotalOf(d)
      if (Math.round(sent) === Math.round(live)) return null
      return { date: d.date, sent, live, delta: live - sent }
    })
    .filter((x): x is { date: string; sent: number; live: number; delta: number } => x !== null)
    .filter((x) => x.date >= todayStr)
  const sentWeekTotal = week.reduce((sum, d) => sum + (sentDayTotal(d.date) ?? 0), 0)
  const driftTotal = driftDays.reduce((s, x) => s + x.delta, 0)

  return (
    <>
      {/* Settings (collapsible) */}
      <Card className="content-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setSettingsOpen(!settingsOpen)}>
          <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Settings</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            Cap: {settings.monthlyMealCap != null ? `₹${settings.monthlyMealCap}/mo` : 'None'} · Delivery: {settings.deliveryCharge != null ? `₹${settings.deliveryCharge}/meal` : 'None'}
            {' '}{settingsOpen ? '▴' : '▾'}
          </span>
        </div>
        {settingsOpen && (
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Monthly cap */}
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: '0.75rem', background: 'var(--color-surface)' }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.5rem' }}>Monthly Meal Price Cap</div>
              {!capEditing ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>{settings.monthlyMealCap != null ? `₹${settings.monthlyMealCap}` : 'No cap set'}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginLeft: '0.5rem' }}>{settings.monthlyMealCap != null ? '/month' : ''}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { setCapInput(settings.monthlyMealCap != null ? String(settings.monthlyMealCap) : ''); setCapEditing(true) }}>Edit</Button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input type="number" placeholder="e.g. 500" value={capInput} onChange={(e) => setCapInput(e.target.value)}
                    style={{ padding: '0.4rem 0.5rem', borderRadius: '0.375rem', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', width: 100 }} />
                  <Button size="sm" onClick={() => { const val = capInput.trim() === '' ? null : parseFloat(capInput); if (val != null && (!Number.isFinite(val) || val < 0)) { toast.add('Cap must be a non-negative number', 'error'); return } updateSettings(val, settings.deliveryCharge) }} disabled={settingsPending}>{settingsPending ? 'Saving…' : 'Save'}</Button>
                  <Button size="sm" variant="outline" onClick={() => setCapEditing(false)}>Cancel</Button>
                  {settings.monthlyMealCap != null && <Button size="sm" variant="danger" onClick={() => updateSettings(null, settings.deliveryCharge)} disabled={settingsPending}>Remove</Button>}
                </div>
              )}
            </div>
            {/* Delivery charge */}
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: '0.75rem', background: 'var(--color-surface)' }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.5rem' }}>Delivery Charge <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>(per meal)</span></div>
              {!deliveryEditing ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>{settings.deliveryCharge != null ? `₹${settings.deliveryCharge}/meal` : 'No charge set'}</span>
                  <Button size="sm" variant="outline" onClick={() => { setDeliveryInput(settings.deliveryCharge != null ? String(settings.deliveryCharge) : ''); setDeliveryEditing(true) }}>Edit</Button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input type="number" placeholder="e.g. 120" value={deliveryInput} onChange={(e) => setDeliveryInput(e.target.value)}
                    style={{ padding: '0.4rem 0.5rem', borderRadius: '0.375rem', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', width: 100 }} />
                  <Button size="sm" onClick={() => { const val = deliveryInput.trim() === '' ? null : parseFloat(deliveryInput); if (val != null && (!Number.isFinite(val) || val < 0)) { toast.add('Delivery charge must be a non-negative number', 'error'); return } updateSettings(settings.monthlyMealCap, val) }} disabled={settingsPending}>{settingsPending ? 'Saving…' : 'Save'}</Button>
                  <Button size="sm" variant="outline" onClick={() => setDeliveryEditing(false)}>Cancel</Button>
                  {settings.deliveryCharge != null && <Button size="sm" variant="danger" onClick={() => updateSettings(settings.monthlyMealCap, null)} disabled={settingsPending}>Remove</Button>}
                </div>
              )}
            </div>
            {/* Auto-import (test utility) */}
            <div style={{ border: '1px dashed var(--color-border)', borderRadius: 8, padding: '0.75rem', background: 'var(--color-surface)' }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>Weekly auto-import <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>(test)</span></div>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Runs the Saturday auto-import into the currently viewed week ({shortDate(weekStart)} – {shortDate(weekEnd)}) for all users — copies their prior week's meals into empty slots only.
              </p>
              <Button size="sm" variant="outline" onClick={handleRunAutoImport} disabled={autoImporting}>
                {autoImporting ? 'Running…' : '↻ Run auto-import now'}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Week header */}
      <Card className="content-card" style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button className="btn btn-outline btn-sm" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Previous week">‹</button>
            <div style={{ minWidth: 150, textAlign: 'center' }}>
              <div style={{ fontWeight: 700 }}>{shortDate(weekStart)} – {shortDate(weekEnd)}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Combined user selections</div>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Next week">›</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Expense</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                {money(expenseTillNow)} <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>/ {money(weekTotal)}</span>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>spent till now / week total</div>
              {sentWeekTotal > 0 && (
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>
                  Sent to shefs: <strong style={{ color: 'var(--color-text)' }}>{money(sentWeekTotal)}</strong>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <Button onClick={handleConfirmWeek} disabled={weekPending} size="sm">
                {weekPending ? (weekProgress || 'Sending…') : 'Send to Shefs…'}
              </Button>
            </div>
          </div>
        </div>
        {driftDays.length > 0 && (
          <div className="drift-banner">
            <span>
              ⚠ {driftDays.length} day{driftDays.length === 1 ? '' : 's'} changed after you sent to shefs
              {' '}({driftTotal >= 0 ? '+' : '−'}{money(Math.abs(driftTotal))}). The vendor still has the amount you sent —
              re-send to bring them in sync.
            </span>
          </div>
        )}
      </Card>

      {/* Day cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
        {week.map((d) => {
          const dayTotal = dayTotalOf(d)
          const today = isTodayStr(d.date)
          const collapsed = collapsedDays.has(d.date)
          const vendorNote = vendorNotesByDate[d.date]
          const finalAmt = vendorNote?.finalAmount ?? null
          // Only strike through when the vendor's final differs from the computed total.
          const showFinal = finalAmt != null && Math.round(finalAmt) !== Math.round(dayTotal)
          const finalStr = finalAmt != null ? money(finalAmt) : ''
          const sentTotal = sentDayTotal(d.date)
          const drifted = sentTotal != null && Math.round(sentTotal) !== Math.round(dayTotal)
          // Past days are frozen: their difference is a record of what was
          // delivered, not something to fix, so it reads informationally.
          const isPastDay = d.date < todayStr
          const driftedDelivered = drifted && isPastDay
          const driftedActionable = drifted && !isPastDay
          return (
            <Card key={d.date} className="content-card" style={today ? { borderColor: 'var(--color-primary)' } : undefined}>
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', cursor: 'pointer' }}
                onClick={() => toggleDayCollapse(d.date)}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', transition: 'transform 0.2s', display: 'inline-block', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▾</span>
                  <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{dayName(d.date)}</h3>
                  <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{shortDate(d.date)}</span>
                  {today && (
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-primary)', background: 'rgba(34,197,94,0.14)', padding: '0.1rem 0.5rem', borderRadius: 999 }}>Today</span>
                  )}
                  {driftedActionable && (
                    <span
                      className="drift-tag"
                      title={`Sent to shefs: ${money(sentTotal!)} · now ${money(dayTotal)}`}
                    >
                      ⚠ changed since sent
                    </span>
                  )}
                  {driftedDelivered && (
                    <span
                      className="delivered-tag"
                      title={`Delivered against the order sent: ${money(sentTotal!)}. Selections changed afterwards but this day is locked.`}
                    >
                      delivered as sent
                    </span>
                  )}
                </div>
                <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {showFinal ? (
                    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', textDecoration: 'line-through' }}>{money(dayTotal)}</span>
                      <span style={{ fontSize: '1.15rem', fontWeight: 800 }}>{finalStr}</span>
                    </span>
                  ) : (
                    <span style={{ fontSize: '1.15rem', fontWeight: 800 }}>{money(dayTotal)}</span>
                  )}
                  {driftedActionable && (
                    <div className="drift-sent">sent {money(sentTotal!)}</div>
                  )}
                  {driftedDelivered && (
                    <div className="delivered-sent">delivered {money(sentTotal!)}</div>
                  )}
                </div>
              </div>

              {collapsed ? (
                (vendorNote?.comment || vendorNote?.adminComment) ? (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                    {vendorNote?.comment ? <div>Vendor: {vendorNote.comment}</div> : null}
                    {vendorNote?.adminComment ? <div>Admin: {vendorNote.adminComment}</div> : null}
                  </div>
                ) : null
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
                    {MEALS.map(({ id: meal, label, icon }) => {
                      const rows = d.meals[meal]
                      const isCancelled = d.cancelled[meal]
                      const isEditing = editing?.date === d.date && editing?.meal === meal
                      return (
                        <div key={meal} style={{ border: '1px solid var(--color-border)', borderRadius: 10, background: 'var(--color-bg)', overflow: 'hidden', opacity: isCancelled ? 0.6 : 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: '0.55rem 0.75rem', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
                            <span style={{ fontSize: '0.8125rem', fontWeight: 700, textDecoration: isCancelled ? 'line-through' : 'none' }}>{icon} {label}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              {!isCancelled && !isEditing && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); openEdit(d.date, meal) }}
                                  title="Edit a user's picks for this meal"
                                  style={{
                                    width: 22, height: 22, borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                                    cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                                  }}
                                  aria-label="Edit user picks"
                                >✏️</button>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleToggleCancel(d.date, meal, isCancelled) }}
                                disabled={toggling}
                                style={{
                                  position: 'relative', width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', padding: 0,
                                  background: isCancelled ? 'var(--color-border)' : 'var(--color-primary, #22c55e)',
                                  transition: 'background 0.2s',
                                }}
                                aria-label={isCancelled ? 'Restore meal' : 'Cancel meal'}
                              >
                                <span style={{
                                  position: 'absolute', top: 2, width: 16, height: 16, borderRadius: 8, background: '#fff',
                                  left: isCancelled ? 2 : 18, transition: 'left 0.2s',
                                }} />
                              </button>
                            </div>
                          </div>
                          {isCancelled ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', padding: '2rem 0.75rem', minHeight: 140 }}>
                              <span style={{ fontSize: '4rem', lineHeight: 1 }}>👨‍🍳</span>
                              <span style={{ color: 'var(--color-danger, #ef4444)', fontSize: '0.875rem', fontWeight: 700 }}>Cancelled — kitchen closed</span>
                            </div>
                          ) : isEditing ? (
                            <div style={{ padding: '0.6rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Overwrite a user's picks for {label.toLowerCase()}:</div>
                              <select
                                value={editUserId}
                                onChange={(e) => pickEditUser(e.target.value)}
                                style={{ padding: '0.35rem 0.4rem', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '0.8125rem', width: '100%' }}
                              >
                                <option value="">Select a user…</option>
                                {users.map((u) => (
                                  <option key={u._id} value={u._id}>{u.name}</option>
                                ))}
                              </select>
                              {editUserId && (
                                <>
                                  {Object.keys(editItems).length === 0 && (
                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No dishes yet — add one below.</div>
                                  )}
                                  {Object.entries(editItems).map(([mid, qty]) => (
                                    <div key={mid} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <span style={{ flex: 1, fontSize: '0.8125rem', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{menuById.get(mid)?.name ?? 'Item'}</span>
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        value={qty}
                                        onChange={(e) => setEditItems((prev) => ({ ...prev, [mid]: sanitizeQty(e.target.value) }))}
                                        style={{ width: 54, padding: '0.25rem 0.3rem', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '0.8125rem', textAlign: 'center' }}
                                      />
                                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', minWidth: 28 }}>{menuById.get(mid)?.unit ?? ''}</span>
                                    </div>
                                  ))}
                                  <select
                                    value={editAddId}
                                    onChange={(e) => { const id = e.target.value; if (id) { setEditItems((prev) => ({ ...prev, [id]: parseFloat(prev[id]) > 0 ? prev[id] : '1' })); setEditAddId('') } }}
                                    style={{ padding: '0.3rem 0.4rem', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '0.8125rem', width: '100%' }}
                                  >
                                    <option value="">+ Add dish…</option>
                                    {menuByMeal[meal]
                                      .filter((mi) => !(parseFloat(editItems[mi._id]) > 0))
                                      .map((mi) => (
                                        <option key={mi._id} value={mi._id}>{mi.name}{mi.pricePerUnit != null ? ` · ₹${mi.pricePerUnit}` : ''}</option>
                                      ))}
                                  </select>
                                  <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>Set a dish to 0 to remove it. Saving overwrites this user's selection.</div>
                                </>
                              )}
                              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem' }}>
                                <button className="btn btn-primary btn-sm" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }} onClick={handleSaveUserSelection} disabled={editSaving || !editUserId}>
                                  {editSaving ? '…' : 'Save'}
                                </button>
                                <button className="btn btn-outline btn-sm" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }} onClick={() => setEditing(null)}>Cancel</button>
                              </div>
                            </div>
                          ) : rows.length === 0 ? (
                            <p style={{ margin: 0, padding: '0.6rem 0.75rem', color: 'var(--color-text-muted)', fontSize: '0.8125rem', fontStyle: 'italic' }}>No selections</p>
                          ) : (
                            <>
                              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                {rows.map((r, i) => (
                                  <li key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--color-border)' }}>
                                    <div style={{ minWidth: 0 }}>
                                      <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{r.name}</div>
                                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                        {r.qty} {r.unit} × {money(r.unitPrice)}
                                      </div>
                                      <WhoChose breakdown={r.personBreakdown} />
                                    </div>
                                    <span style={{ fontSize: '0.875rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{money(r.amount)}</span>
                                  </li>
                                ))}
                              </ul>
                              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', fontSize: '0.8125rem', fontWeight: 700 }}>
                                <span>Subtotal</span>
                                <span>{money(d.subtotals[meal])}</span>
                              </div>
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1.5rem', flexWrap: 'wrap', marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid var(--color-border)', fontSize: '0.875rem' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Meals <strong style={{ color: 'var(--color-text)' }}>{money(d.mealsTotal)}</strong></span>
                    <span style={{ color: 'var(--color-text-muted)' }}>Delivery <strong style={{ color: 'var(--color-text)' }}>{deliveryOf(d) > 0 ? `${money(deliveryOf(d))} (${activeMealsOf(d)} × ${money(delivery)})` : '—'}</strong></span>
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      Day total{' '}
                      {showFinal ? (
                        <>
                          <strong style={{ color: 'var(--color-text-muted)', fontWeight: 600, textDecoration: 'line-through' }}>{money(dayTotal)}</strong>{' '}
                          <strong style={{ color: 'var(--color-primary)', fontSize: '1rem' }}>{finalStr}</strong>
                        </>
                      ) : (
                        <strong style={{ color: 'var(--color-primary)', fontSize: '1rem' }}>{money(dayTotal)}</strong>
                      )}
                    </span>
                  </div>

                  {/* Comments: vendor's note + admin's own comment / reply */}
                  <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {vendorNote?.comment ? (
                      <div>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>Vendor</div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>{vendorNote.comment}</div>
                      </div>
                    ) : null}

                    {commentEditDay === d.date ? (
                      <div style={{ padding: '0.75rem', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-surface)' }}>
                        <textarea
                          value={commentDraft}
                          onChange={(e) => setCommentDraft(e.target.value)}
                          placeholder={vendorNote?.comment ? 'Reply to the vendor…' : 'Add a comment…'}
                          rows={2}
                          style={{ width: '100%', padding: '0.35rem 0.5rem', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.8125rem', resize: 'vertical', boxSizing: 'border-box' }}
                        />
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                          <button className="btn btn-primary btn-sm" onClick={() => saveAdminComment(d.date)} disabled={adminCommentSaving}>{adminCommentSaving ? 'Saving…' : 'Save'}</button>
                          <button className="btn btn-outline btn-sm" onClick={() => setCommentEditDay(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <div style={{ flex: 1 }}>
                          {vendorNote?.adminComment ? (
                            <div>
                              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-primary)' }}>Admin</div>
                              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>{vendorNote.adminComment}</div>
                            </div>
                          ) : null}
                        </div>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => openCommentEdit(d.date)}
                          style={{ whiteSpace: 'nowrap', fontSize: '0.75rem' }}
                        >
                          {vendorNote?.adminComment ? 'Edit' : vendorNote?.comment ? 'Reply' : 'Comment'}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </Card>
          )
        })}
      </div>
    </>
  )
}
