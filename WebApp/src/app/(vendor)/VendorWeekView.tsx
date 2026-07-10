import { useMemo, useState } from 'react'
import { useConfirmedOrdersForRange, useMenuItems, useSettings, useMealCancellationsForRange, useVendorDayNotesForRange, useUpdateVendorDayNote } from '@/shared/graphql/hooks'
import { Card, Loader } from '@/shared/ui'
import { Link } from 'react-router-dom'
import { useToastStore } from '@/shared/stores/toastStore'
import type { ConfirmedOrder } from '@/shared/types'

function toDateString(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Monday of the week containing the given date (YYYY-MM-DD). */
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

type Row = { name: string; unit: string; qty: number; unitPrice: number; amount: number }
type DayData = {
  date: string
  meals: Record<Meal, Row[]>
  subtotals: Record<Meal, number>
  cancelled: Record<Meal, boolean>
  mealsTotal: number
}

function isTodayStr(dateStr: string): boolean {
  return dateStr === toDateString(new Date())
}

export function VendorWeekView() {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(toDateString(new Date())))
  const weekEnd = addDays(weekStart, 6)
  const dates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  const { orders, isLoading: ordersLoading, refetch: refetchOrders } = useConfirmedOrdersForRange(weekStart, weekEnd)
  const [refreshing, setRefreshing] = useState(false)
  const { items: menuItems, isLoading: menuLoading } = useMenuItems()
  const { settings, isLoading: settingsLoading } = useSettings()
  const { cancellations, isLoading: cancelLoading, refetch: refetchCancellations } = useMealCancellationsForRange(weekStart, weekEnd)
  const { notes, isLoading: notesLoading, refetch: refetchNotes } = useVendorDayNotesForRange(weekStart, weekEnd)

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await Promise.all([refetchOrders(), refetchCancellations(), refetchNotes()])
      toast.add('Refreshed.', 'success')
    } catch (e) {
      toast.add((e as Error).message, 'error')
    } finally {
      setRefreshing(false)
    }
  }
  const { update: updateNote, isPending: noteSaving } = useUpdateVendorDayNote()
  const toast = useToastStore()

  const [editingDay, setEditingDay] = useState<string | null>(null)
  const [draftAmount, setDraftAmount] = useState('')
  const [draftComment, setDraftComment] = useState('')
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set())

  const notesByDate = useMemo(() => {
    const map: Record<string, { finalAmount: number | null; comment: string }> = {}
    for (const n of notes) map[n.date] = { finalAmount: n.finalAmount, comment: n.comment }
    return map
  }, [notes])

  const toggleDayCollapse = (date: string) => {
    setCollapsedDays(prev => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  const openEdit = (date: string, calcTotal: number) => {
    const existing = notesByDate[date]
    setDraftAmount(existing?.finalAmount != null ? String(existing.finalAmount) : String(Math.round(calcTotal)))
    setDraftComment(existing?.comment ?? '')
    setEditingDay(date)
  }

  const saveNote = async (date: string) => {
    const amt = draftAmount.trim() === '' ? null : Number(draftAmount)
    if (amt != null && isNaN(amt)) { toast.add('Amount must be a number', 'error'); return }
    try {
      await updateNote(date, amt, draftComment.trim())
      await refetchNotes()
      setEditingDay(null)
    } catch (e) {
      toast.add((e as Error).message, 'error')
    }
  }

  const cancelledSet = useMemo(() => {
    const s = new Set<string>()
    for (const c of cancellations) s.add(`${c.date}|${c.mealType}`)
    return s
  }, [cancellations])

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
      const cancelled = {
        breakfast: cancelledSet.has(`${date}|breakfast`),
        lunch: cancelledSet.has(`${date}|lunch`),
        dinner: cancelledSet.has(`${date}|dinner`),
      }
      for (const { id: meal } of MEALS) {
        const order = byKey.get(`${date}|${meal}`)
        if (!order) continue
        for (const it of order.items) {
          const unitPrice = priceByMenuId[it.menuItemId] ?? 0
          const amount = unitPrice * it.quantity
          meals[meal].push({ name: it.name, unit: it.unit, qty: it.quantity, unitPrice, amount })
          subtotals[meal] += amount
        }
      }
      // Cancelled meals don't count toward the day total.
      const mealsTotal = MEALS.reduce((s, { id: meal }) => s + (cancelled[meal] ? 0 : subtotals[meal]), 0)
      return { date, meals, subtotals, cancelled, mealsTotal }
    })
  }, [dates, orders, priceByMenuId, cancelledSet])

  const isLoading = ordersLoading || menuLoading || settingsLoading || cancelLoading || notesLoading
  if (isLoading) return <Loader />

  const todayStr = toDateString(new Date())
  // Delivery is charged per active meal (has an order and not cancelled).
  const activeMealsOf = (d: DayData) => MEALS.filter(({ id }) => !d.cancelled[id] && d.subtotals[id] > 0).length
  const deliveryOf = (d: DayData) => delivery * activeMealsOf(d)
  const calcDayTotal = (d: DayData) => d.mealsTotal + deliveryOf(d)
  const effectiveDayTotal = (d: DayData) => notesByDate[d.date]?.finalAmount ?? calcDayTotal(d)
  const weekTotal = week.reduce((sum, d) => sum + effectiveDayTotal(d), 0)
  const expenseTillNow = week.reduce((sum, d) => sum + (d.date <= todayStr ? effectiveDayTotal(d) : 0), 0)

  return (
    <>
      {/* Week header */}
      <Card className="content-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button className="btn btn-outline btn-sm" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Previous week">‹</button>
            <div style={{ minWidth: 150, textAlign: 'center' }}>
              <div style={{ fontWeight: 700 }}>{shortDate(weekStart)} – {shortDate(weekEnd)}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Confirmed orders</div>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Next week">›</button>
            <button className="btn btn-outline btn-sm" onClick={handleRefresh} disabled={refreshing} aria-label="Refresh" title="Refresh confirmed orders" style={{ marginLeft: '0.25rem' }}>
              {refreshing ? '…' : '↻ Refresh'}
            </button>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Expense</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-primary)' }}>
              {money(expenseTillNow)} <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>/ {money(weekTotal)}</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>spent till now / week total</div>
          </div>
        </div>
      </Card>

      {/* Day cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
        {week.map((d) => {
          const calcTotal = calcDayTotal(d)
          const dayTotal = effectiveDayTotal(d)
          const note = notesByDate[d.date]
          const hasOverride = note?.finalAmount != null
          const today = isTodayStr(d.date)
          const isEditing = editingDay === d.date
          const collapsed = collapsedDays.has(d.date)
          return (
            <Card key={d.date} className="content-card" style={today ? { borderColor: 'var(--color-primary)' } : undefined}>
              {/* Day header — clickable to collapse */}
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
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '1.15rem', fontWeight: 800, color: hasOverride ? 'var(--color-primary)' : undefined }}>{money(dayTotal)}</span>
                  {hasOverride && <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>calc: {money(calcTotal)}</div>}
                </div>
              </div>

              {collapsed ? (
                note?.comment ? (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                    {note.comment}
                  </div>
                ) : null
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
                    {MEALS.map(({ id: meal, label, icon }) => {
                      const rows = d.meals[meal]
                      const isCancelled = d.cancelled[meal]
                      return (
                        <div key={meal} style={{ border: '1px solid var(--color-border)', borderRadius: 10, background: 'var(--color-bg)', overflow: 'hidden', opacity: isCancelled ? 0.6 : 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: '0.55rem 0.75rem', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
                            <span style={{ fontSize: '0.8125rem', fontWeight: 700, textDecoration: isCancelled ? 'line-through' : 'none' }}>{icon} {label}</span>
                            {isCancelled && (
                              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-danger, #ef4444)' }}>Cancelled</span>
                            )}
                          </div>
                          {isCancelled ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', padding: '2rem 0.75rem', minHeight: 140 }}>
                              <span style={{ fontSize: '4rem', lineHeight: 1 }}>👨‍🍳</span>
                              <span style={{ color: 'var(--color-danger, #ef4444)', fontSize: '0.875rem', fontWeight: 700 }}>Cancelled — kitchen closed</span>
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
                        </div>
                      )
                    })}
                  </div>

                  {/* Day footer: meals + delivery = total */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1.5rem', flexWrap: 'wrap', marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid var(--color-border)', fontSize: '0.875rem' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Meals <strong style={{ color: 'var(--color-text)' }}>{money(d.mealsTotal)}</strong></span>
                    <span style={{ color: 'var(--color-text-muted)' }}>Delivery <strong style={{ color: 'var(--color-text)' }}>{deliveryOf(d) > 0 ? `${money(deliveryOf(d))} (${activeMealsOf(d)} × ${money(delivery)})` : '—'}</strong></span>
                    <span style={{ color: 'var(--color-text-muted)' }}>Day total <strong style={{ color: 'var(--color-primary)', fontSize: '1rem' }}>{money(calcTotal)}</strong></span>
                  </div>

                  {/* Final amount & comment */}
                  {isEditing ? (
                    <div style={{ marginTop: '0.75rem', padding: '0.75rem', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-surface)' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <label style={{ fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap' }}>Final amount</label>
                        <input
                          type="number"
                          value={draftAmount}
                          onChange={(e) => setDraftAmount(e.target.value)}
                          style={{ padding: '0.35rem 0.5rem', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', width: 100, fontSize: '0.875rem' }}
                        />
                      </div>
                      <textarea
                        value={draftComment}
                        onChange={(e) => setDraftComment(e.target.value)}
                        placeholder="Add a comment…"
                        rows={2}
                        style={{ width: '100%', padding: '0.35rem 0.5rem', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.8125rem', resize: 'vertical', boxSizing: 'border-box' }}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button className="btn btn-primary btn-sm" onClick={() => saveNote(d.date)} disabled={noteSaving}>{noteSaving ? 'Saving…' : 'Save'}</button>
                        <button className="btn btn-outline btn-sm" onClick={() => setEditingDay(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', flex: 1 }}>
                        {note?.comment ? <span style={{ fontStyle: 'italic' }}>{note.comment}</span> : null}
                      </div>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => openEdit(d.date, calcTotal)}
                        style={{ whiteSpace: 'nowrap', fontSize: '0.75rem' }}
                      >
                        {hasOverride ? 'Edit' : 'Set final amount'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </Card>
          )
        })}
      </div>

      <p style={{ marginTop: '1rem', textAlign: 'center' }}>
        <Link to="/vendor/menu" style={{ color: 'var(--color-primary)' }}>Update menu</Link>
      </p>
    </>
  )
}
