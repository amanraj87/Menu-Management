import { useMemo, useState } from 'react'
import { useApolloClient } from '@apollo/client/react'
import {
  useConfirmedOrdersForRange,
  useAggregatedOrdersForRange,
  useMenuItems,
  useSettings,
  useUpdateSettings,
  useMealCancellationsForRange,
  useToggleMealCancellation,
  useVendorDayNotesForRange,
} from '@/shared/graphql/hooks'
import { AGGREGATED_ORDER, CONFIRM_ORDER_WITH_ITEMS, CONFIRMED_ORDERS_FOR_RANGE } from '@/shared/graphql/operations'
import { Card, Button, Loader } from '@/shared/ui'
import { useToastStore } from '@/shared/stores/toastStore'
import type { ConfirmedOrder, MealType } from '@/shared/types'

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

const MEALS: { id: Meal; label: string; icon: string }[] = [
  { id: 'breakfast', label: 'Breakfast', icon: '🌅' },
  { id: 'lunch', label: 'Lunch', icon: '☀️' },
  { id: 'dinner', label: 'Dinner', icon: '🌙' },
]
type Meal = 'breakfast' | 'lunch' | 'dinner'

type Row = { menuItemId: string; name: string; unit: string; qty: number; unitPrice: number; amount: number }
type PendingItem = { menuItemId: string; name: string; unit: string; aggQty: number; confirmedQty: number }
type DayData = {
  date: string
  meals: Record<Meal, Row[]>
  subtotals: Record<Meal, number>
  cancelled: Record<Meal, boolean>
  pending: Record<Meal, PendingItem[]>
  mealsTotal: number
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

  const { orders, isLoading: ordersLoading } = useConfirmedOrdersForRange(weekStart, weekEnd)
  const { aggregated } = useAggregatedOrdersForRange(weekStart, weekEnd)
  const { items: menuItems, isLoading: menuLoading } = useMenuItems()
  const { settings, isLoading: settingsLoading } = useSettings()
  const { cancellations, isLoading: cancelLoading, refetch: refetchCancellations } = useMealCancellationsForRange(weekStart, weekEnd)
  const { notes: vendorNotes, isLoading: notesLoading } = useVendorDayNotesForRange(weekStart, weekEnd)
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
  const [editingMeal, setEditingMeal] = useState<{ date: string; meal: Meal } | null>(null)
  const [editQtys, setEditQtys] = useState<Record<string, number>>({})
  const [editNewId, setEditNewId] = useState('')
  const [editNewQty, setEditNewQty] = useState('1')
  const [editSaving, setEditSaving] = useState(false)
  // One shared guard for every write that touches confirmed orders — running
  // confirm/edit concurrently interleaves full-replace writes.
  const writeBusy = weekPending || editSaving

  const cancelledSet = useMemo(() => {
    const s = new Set<string>()
    for (const c of cancellations) s.add(`${c.date}|${c.mealType}`)
    return s
  }, [cancellations])

  // Live user selections keyed by date|meal → (menuItemId → {name, unit, qty}).
  const aggByKey = useMemo(() => {
    const map = new Map<string, Map<string, { name: string; unit: string; qty: number }>>()
    for (const a of aggregated) {
      const key = `${a.date}|${a.mealType}`
      const items = new Map<string, { name: string; unit: string; qty: number }>()
      for (const it of a.items) items.set(it.menuItemId, { name: it.name, unit: it.unit, qty: it.quantity })
      map.set(key, items)
    }
    return map
  }, [aggregated])

  const vendorNotesByDate = useMemo(() => {
    const map: Record<string, { finalAmount: number | null; comment: string }> = {}
    for (const n of vendorNotes) map[n.date] = { finalAmount: n.finalAmount, comment: n.comment }
    return map
  }, [vendorNotes])

  const toggleDayCollapse = (date: string) => {
    setCollapsedDays(prev => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  const menuByMeal = useMemo(() => {
    const map: Record<Meal, typeof menuItems> = { breakfast: [], lunch: [], dinner: [] }
    for (const m of menuItems) if (m.mealType && map[m.mealType as Meal]) map[m.mealType as Meal].push(m)
    return map
  }, [menuItems])

  const handleStartEdit = (date: string, meal: Meal) => {
    if (writeBusy) return
    const rows = orders
      .filter(o => o.date === date && o.mealType === meal)
      .flatMap(o => o.items)
    const qtys: Record<string, number> = {}
    for (const it of rows) qtys[it.menuItemId] = it.quantity
    setEditQtys(qtys)
    setEditNewId('')
    setEditNewQty('1')
    setEditingMeal({ date, meal })
  }

  const handleSaveEdit = async () => {
    if (!editingMeal || weekPending) return
    const { date, meal } = editingMeal

    const existing = orders
      .filter(o => o.date === date && o.mealType === meal)
      .flatMap(o => o.items)

    const items: { menuItemId: string; name: string; unit: string; quantity: number }[] = []
    for (const it of existing) {
      const qty = editQtys[it.menuItemId] ?? 0
      if (qty > 0) items.push({ menuItemId: it.menuItemId, name: it.name, unit: it.unit, quantity: qty })
    }

    if (editNewId) {
      const mi = menuItems.find(m => m._id === editNewId)
      const nq = Math.max(1, Math.round(Number(editNewQty) || 1))
      if (mi) {
        const idx = items.findIndex(i => i.menuItemId === editNewId)
        if (idx >= 0) items[idx] = { ...items[idx], quantity: items[idx].quantity + nq }
        else items.push({ menuItemId: mi._id, name: mi.name, unit: mi.unit, quantity: nq })
      }
    }

    setEditSaving(true)
    try {
      await client.mutate({
        mutation: CONFIRM_ORDER_WITH_ITEMS,
        variables: { date, mealType: meal, items },
      })
      await client.refetchQueries({ include: [CONFIRMED_ORDERS_FOR_RANGE] })
      setEditingMeal(null)
      toast.add('Saved.', 'success')
    } catch (e) {
      toast.add((e as Error).message, 'error')
    } finally {
      setEditSaving(false)
    }
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

  const delivery = settings.deliveryCharge ?? 0

  const week: DayData[] = useMemo(() => {
    const byKey = new Map<string, ConfirmedOrder>()
    for (const o of orders) byKey.set(`${o.date}|${o.mealType}`, o)

    return dates.map((date) => {
      const meals = { breakfast: [] as Row[], lunch: [] as Row[], dinner: [] as Row[] }
      const subtotals = { breakfast: 0, lunch: 0, dinner: 0 }
      const pending: Record<Meal, PendingItem[]> = { breakfast: [], lunch: [], dinner: [] }
      const cancelled = {
        breakfast: cancelledSet.has(`${date}|breakfast`),
        lunch: cancelledSet.has(`${date}|lunch`),
        dinner: cancelledSet.has(`${date}|dinner`),
      }
      for (const { id: meal } of MEALS) {
        const order = byKey.get(`${date}|${meal}`)
        const confirmedQtys = new Map<string, number>()
        if (order) {
          for (const it of order.items) {
            const unitPrice = priceByMenuId[it.menuItemId] ?? 0
            const amount = unitPrice * it.quantity
            meals[meal].push({ menuItemId: it.menuItemId, name: it.name, unit: it.unit, qty: it.quantity, unitPrice, amount })
            subtotals[meal] += amount
            confirmedQtys.set(it.menuItemId, it.quantity)
          }
        }
        // Compare live user selections against what's confirmed. Any add/change
        // (present in the aggregated demand but not yet matching a confirmed qty)
        // is flagged as pending — i.e. not yet sent to the kitchen.
        const agg = aggByKey.get(`${date}|${meal}`)
        if (agg) {
          for (const [menuItemId, info] of agg) {
            const confirmedQty = confirmedQtys.get(menuItemId) ?? 0
            if (info.qty !== confirmedQty) {
              pending[meal].push({ menuItemId, name: info.name, unit: info.unit, aggQty: info.qty, confirmedQty })
            }
          }
        }
      }
      const mealsTotal = MEALS.reduce((s, { id: meal }) => s + (cancelled[meal] ? 0 : subtotals[meal]), 0)
      return { date, meals, subtotals, cancelled, pending, mealsTotal }
    })
  }, [dates, orders, priceByMenuId, cancelledSet, aggByKey])

  const handleConfirmWeek = async () => {
    if (writeBusy) return
    const combos = dates.flatMap((d) => MEALS.map((m) => ({ date: d, meal: m.id })))
    setWeekPending(true)
    setWeekProgress('')
    let confirmed = 0
    let skipped = 0
    let done = 0
    try {
      for (const { date: d, meal: m } of combos) {
        const res = await client.query<{ aggregatedOrder: { items: any[] } | null }>({
          query: AGGREGATED_ORDER,
          variables: { date: d, mealType: m },
          fetchPolicy: 'network-only',
        })
        const aggItems = res.data?.aggregatedOrder?.items ?? []
        if (aggItems.length === 0) {
          skipped++
        } else {
          const existing = orders
            .filter(o => o.date === d && o.mealType === m)
            .flatMap(o => o.items)
          // Existing items (imports/manual adds) are kept; aggregated user
          // selections overwrite their own items so re-confirming is idempotent.
          const merged = new Map<string, { menuItemId: string; name: string; unit: string; quantity: number }>()
          for (const it of existing) merged.set(it.menuItemId, { menuItemId: it.menuItemId, name: it.name, unit: it.unit, quantity: it.quantity })
          for (const it of aggItems) {
            merged.set(it.menuItemId, { menuItemId: it.menuItemId, name: it.name, unit: it.unit, quantity: it.quantity })
          }
          await client.mutate({
            mutation: CONFIRM_ORDER_WITH_ITEMS,
            variables: {
              date: d,
              mealType: m,
              items: Array.from(merged.values()),
            },
          })
          confirmed++
        }
        done++
        setWeekProgress(`Processing ${done}/${combos.length}…`)
      }
      await client.refetchQueries({ include: [CONFIRMED_ORDERS_FOR_RANGE] })
      toast.add(
        confirmed > 0
          ? `Confirmed ${confirmed} meal${confirmed === 1 ? '' : 's'} for the week (${skipped} had no selections).`
          : 'No selections found for any meal this week.',
        confirmed > 0 ? 'success' : 'info'
      )
    } catch (e) {
      toast.add((e as Error).message, 'error')
    } finally {
      setWeekPending(false)
      setWeekProgress('')
    }
  }

  const isLoading = ordersLoading || menuLoading || settingsLoading || cancelLoading || notesLoading
  if (isLoading) return <Loader />

  const todayStr = toDateString(new Date())
  // Delivery is charged per active meal (has an order and not cancelled), so a
  // cancelled/empty meal drops its share of the delivery fee.
  const activeMealsOf = (d: DayData) => MEALS.filter(({ id }) => !d.cancelled[id] && d.subtotals[id] > 0).length
  const deliveryOf = (d: DayData) => delivery * activeMealsOf(d)
  const dayTotalOf = (d: DayData) => d.mealsTotal + deliveryOf(d)
  const weekTotal = week.reduce((sum, d) => sum + dayTotalOf(d), 0)
  const expenseTillNow = week.reduce((sum, d) => sum + (d.date <= todayStr ? dayTotalOf(d) : 0), 0)

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
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Confirmed orders</div>
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
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <Button onClick={handleConfirmWeek} disabled={writeBusy} size="sm">
                {weekPending ? (weekProgress || 'Confirming…') : 'Send to Shefs…'}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Day cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
        {week.map((d) => {
          const dayTotal = dayTotalOf(d)
          const today = isTodayStr(d.date)
          const collapsed = collapsedDays.has(d.date)
          const vendorNote = vendorNotesByDate[d.date]
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
                </div>
                <span style={{ fontSize: '1.15rem', fontWeight: 800 }}>{money(dayTotal)}</span>
              </div>

              {collapsed ? (
                vendorNote?.comment ? (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                    {vendorNote.comment}
                  </div>
                ) : null
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
                    {MEALS.map(({ id: meal, label, icon }) => {
                      const rows = d.meals[meal]
                      const isCancelled = d.cancelled[meal]
                      const isEditing = editingMeal?.date === d.date && editingMeal?.meal === meal
                      const pendingItems = d.pending[meal]
                      const hasPending = !isCancelled && pendingItems.length > 0
                      return (
                        <div key={meal} style={{ border: hasPending ? '1px solid var(--color-warning, #f59e0b)' : '1px solid var(--color-border)', borderRadius: 10, background: 'var(--color-bg)', overflow: 'hidden', opacity: isCancelled ? 0.6 : 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: '0.55rem 0.75rem', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
                            <span style={{ fontSize: '0.8125rem', fontWeight: 700, textDecoration: isCancelled ? 'line-through' : 'none', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              {icon} {label}
                              {hasPending && (
                                <span title="Users changed their picks since the last send" style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-warning, #b45309)', background: 'rgba(245,158,11,0.16)', padding: '0.05rem 0.4rem', borderRadius: 999 }}>
                                  ⏳ {pendingItems.length} pending
                                </span>
                              )}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              {!isCancelled && !isEditing && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleStartEdit(d.date, meal) }}
                                  style={{
                                    width: 22, height: 22, borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                                    cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                                  }}
                                  aria-label="Edit meal"
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
                            <p style={{ margin: 0, padding: '0.6rem 0.75rem', color: 'var(--color-danger, #ef4444)', fontSize: '0.8125rem', fontWeight: 600 }}>
                              Cancelled — kitchen closed
                            </p>
                          ) : (
                            <>
                              {isEditing ? (
                                <div style={{ padding: '0.5rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                  {rows.map((r) => (
                                    <div key={r.menuItemId} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <span style={{ flex: 1, fontSize: '0.8125rem', fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                                      <input
                                        type="number"
                                        min="0"
                                        value={editQtys[r.menuItemId] ?? 0}
                                        onChange={(e) => setEditQtys(prev => ({ ...prev, [r.menuItemId]: Math.max(0, Number(e.target.value) || 0) }))}
                                        style={{ width: 54, padding: '0.25rem 0.3rem', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '0.8125rem', textAlign: 'center' }}
                                      />
                                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', minWidth: 30 }}>{r.unit}</span>
                                    </div>
                                  ))}
                                  <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '0.4rem', marginTop: '0.2rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    <select
                                      value={editNewId}
                                      onChange={(e) => setEditNewId(e.target.value)}
                                      style={{ padding: '0.3rem 0.4rem', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '0.8125rem', width: '100%' }}
                                    >
                                      <option value="">+ Add item…</option>
                                      {menuByMeal[meal]
                                        .filter(mi => !rows.some(r => r.menuItemId === mi._id))
                                        .map(mi => (
                                          <option key={mi._id} value={mi._id}>{mi.name} ({mi.unit}{mi.pricePerUnit != null ? ` · ₹${mi.pricePerUnit}` : ''})</option>
                                        ))}
                                    </select>
                                    {editNewId && (
                                      <input
                                        type="number"
                                        min="1"
                                        value={editNewQty}
                                        onChange={(e) => setEditNewQty(e.target.value)}
                                        placeholder="Qty"
                                        style={{ width: 54, padding: '0.25rem 0.3rem', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '0.8125rem' }}
                                      />
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem' }}>
                                    <button className="btn btn-primary btn-sm" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }} onClick={handleSaveEdit} disabled={editSaving}>
                                      {editSaving ? '…' : 'Save'}
                                    </button>
                                    <button className="btn btn-outline btn-sm" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }} onClick={() => setEditingMeal(null)}>
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : rows.length === 0 ? (
                                <p style={{ margin: 0, padding: '0.6rem 0.75rem', color: 'var(--color-text-muted)', fontSize: '0.8125rem', fontStyle: 'italic' }}>No order</p>
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
                              {!isEditing && hasPending && (
                                <div style={{ padding: '0.5rem 0.75rem', borderTop: '1px solid var(--color-border)', background: 'rgba(245,158,11,0.07)' }}>
                                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-warning, #b45309)', marginBottom: '0.35rem' }}>
                                    Pending — not yet sent to Shefs
                                  </div>
                                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                    {pendingItems.map((p) => (
                                      <li key={p.menuItemId} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.8125rem' }}>
                                        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                                        <span style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                                          {p.aggQty} {p.unit}
                                          {p.confirmedQty > 0 && (
                                            <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}> (sent: {p.confirmedQty})</span>
                                          )}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1.5rem', flexWrap: 'wrap', marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid var(--color-border)', fontSize: '0.875rem' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Meals <strong style={{ color: 'var(--color-text)' }}>{money(d.mealsTotal)}</strong></span>
                    <span style={{ color: 'var(--color-text-muted)' }}>Delivery <strong style={{ color: 'var(--color-text)' }}>{deliveryOf(d) > 0 ? `${money(deliveryOf(d))} (${activeMealsOf(d)} × ${money(delivery)})` : '—'}</strong></span>
                    <span style={{ color: 'var(--color-text-muted)' }}>Day total <strong style={{ color: 'var(--color-primary)', fontSize: '1rem' }}>{money(dayTotal)}</strong></span>
                  </div>

                  {vendorNote?.comment && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                      Vendor: {vendorNote.comment}
                    </div>
                  )}
                </>
              )}
            </Card>
          )
        })}
      </div>
    </>
  )
}
