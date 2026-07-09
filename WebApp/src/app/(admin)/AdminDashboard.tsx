import { useMemo, useState } from 'react'
import { Card, Badge, Loader, Button } from '@/shared/ui'
import { Link } from 'react-router-dom'
import { useUsers, useFeedbacksForAdmin, useMenuItems, useConfirmedOrdersForRange, useSettings, useUpdateSettings } from '@/shared/graphql/hooks'
import { useToastStore } from '@/shared/stores/toastStore'
import type { ConfirmedOrder } from '@/shared/types'

function toDateString(d: Date) {
  return d.toISOString().slice(0, 10)
}

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return toDateString(d)
}

function getWeekEnd(weekStart: string): string {
  const d = new Date(weekStart + 'T12:00:00')
  d.setDate(d.getDate() + 6)
  return toDateString(d)
}

function getMonthStart(dateStr: string): string {
  return dateStr.slice(0, 8) + '01'
}

function getMonthEnd(dateStr: string): string {
  const year = parseInt(dateStr.slice(0, 4), 10)
  const month = parseInt(dateStr.slice(5, 7), 10)
  const lastDay = new Date(year, month, 0).getDate()
  return `${dateStr.slice(0, 8)}${String(lastDay).padStart(2, '0')}`
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return toDateString(d)
}

function prettyDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

type Period = 'day' | 'week' | 'month' | 'custom'
type ExpenseMode = 'week' | 'month'

function computeExpense(
  orders: ConfirmedOrder[],
  priceByMenuId: Record<string, number>
): { total: number; perPerson: Array<{ userId: string; userName: string; total: number }> } {
  const personMap = new Map<string, { userName: string; total: number }>()
  let total = 0
  for (const order of orders) {
    for (const item of order.items) {
      const price = priceByMenuId[item.menuItemId] ?? 0
      const itemTotal = item.quantity * price
      total += itemTotal
      for (const p of item.personBreakdown) {
        const personCost = p.quantity * price
        const existing = personMap.get(p.userId)
        if (existing) {
          existing.total += personCost
        } else {
          personMap.set(p.userId, { userName: p.userName, total: personCost })
        }
      }
    }
  }
  const perPerson = Array.from(personMap.entries())
    .map(([userId, { userName, total: t }]) => ({ userId, userName, total: t }))
    .sort((a, b) => b.total - a.total)
  return { total, perPerson }
}

function computeDishBreakdown(
  orders: ConfirmedOrder[]
): Array<{ name: string; unit: string; quantity: number }> {
  const dishMap = new Map<string, { name: string; unit: string; quantity: number }>()
  for (const order of orders) {
    for (const item of order.items) {
      const existing = dishMap.get(item.menuItemId)
      if (existing) {
        existing.quantity += item.quantity
      } else {
        dishMap.set(item.menuItemId, { name: item.name, unit: item.unit, quantity: item.quantity })
      }
    }
  }
  return Array.from(dishMap.values()).sort((a, b) => b.quantity - a.quantity)
}

function formatMoney(n: number): string {
  return Number.isFinite(n) ? `₹${n.toFixed(2)}` : '₹0.00'
}

export function AdminDashboard() {
  const today = toDateString(new Date())
  const toast = useToastStore()

  const [expenseMode, setExpenseMode] = useState<ExpenseMode>('week')
  const [expenseWeekStart, setExpenseWeekStart] = useState(() => getWeekStart(today))
  const [expenseMonth, setExpenseMonth] = useState(() => today.slice(0, 7))

  const [dishPeriod, setDishPeriod] = useState<Period>('day')
  const [dishCustomStart, setDishCustomStart] = useState(today)
  const [dishCustomEnd, setDishCustomEnd] = useState(today)

  const [capInput, setCapInput] = useState('')
  const [capEditing, setCapEditing] = useState(false)

  const { users, isLoading: usersLoading } = useUsers()
  const { feedbacks, isLoading: feedbackLoading } = useFeedbacksForAdmin()
  const { items: menuItems, isLoading: menuLoading } = useMenuItems()
  const { settings, isLoading: settingsLoading } = useSettings()
  const { updateSettings, isPending: settingsPending } = useUpdateSettings(
    () => { toast.add('Monthly cap updated.', 'success'); setCapEditing(false) },
    (e) => toast.add(e.message, 'error')
  )

  const weekStart = getWeekStart(today)
  const weekEnd = getWeekEnd(weekStart)
  const monthStart = getMonthStart(today)
  const monthEnd = getMonthEnd(today)

  function getRange(period: Period, customStart: string, customEnd: string): [string, string] {
    switch (period) {
      case 'day': return [today, today]
      case 'week': return [weekStart, weekEnd]
      case 'month': return [monthStart, monthEnd]
      case 'custom': return [customStart, customEnd]
    }
  }

  const weekOptions = useMemo(() => {
    const arr: Array<{ start: string; end: string; label: string }> = []
    const curWeekStart = getWeekStart(today)
    for (let i = 0; i < 12; i++) {
      const start = addDays(curWeekStart, -7 * i)
      const end = getWeekEnd(start)
      arr.push({ start, end, label: `${prettyDate(start)} – ${prettyDate(end)}${i === 0 ? ' (This week)' : ''}` })
    }
    return arr
  }, [today])

  const monthOptions = useMemo(() => {
    const arr: Array<{ value: string; start: string; end: string; label: string }> = []
    const y = parseInt(today.slice(0, 4), 10)
    const m = parseInt(today.slice(5, 7), 10)
    for (let i = 0; i < 12; i++) {
      let yy = y
      let mm = m - i
      while (mm <= 0) { mm += 12; yy -= 1 }
      const value = `${yy}-${String(mm).padStart(2, '0')}`
      const start = `${value}-01`
      const end = getMonthEnd(start)
      const label = new Date(yy, mm - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) + (i === 0 ? ' (This month)' : '')
      arr.push({ value, start, end, label })
    }
    return arr
  }, [today])

  const [expStart, expEnd] = expenseMode === 'week'
    ? [expenseWeekStart, getWeekEnd(expenseWeekStart)]
    : [`${expenseMonth}-01`, getMonthEnd(`${expenseMonth}-01`)]
  const [dshStart, dshEnd] = getRange(dishPeriod, dishCustomStart, dishCustomEnd)

  const { orders: expenseOrders, isLoading: expenseOrdersLoading } = useConfirmedOrdersForRange(expStart, expEnd)
  const { orders: dishOrders, isLoading: dishOrdersLoading } = useConfirmedOrdersForRange(dshStart, dshEnd)

  const priceByMenuId = useMemo(() => {
    const map: Record<string, number> = {}
    for (const m of menuItems) {
      if (m.pricePerUnit != null && Number.isFinite(m.pricePerUnit)) {
        map[m._id] = m.pricePerUnit
      }
    }
    return map
  }, [menuItems])

  const expenseData = useMemo(() => computeExpense(expenseOrders, priceByMenuId), [expenseOrders, priceByMenuId])
  const dishData = useMemo(() => computeDishBreakdown(dishOrders), [dishOrders])

  const pendingFeedback = feedbacks.filter((f) => f.status === 'pending').length
  const isLoading = usersLoading || feedbackLoading || menuLoading || settingsLoading

  if (isLoading) return <Loader />

  const personCount = users.filter((u) => u.role === 'person').length
  const vendorCount = users.filter((u) => u.role === 'vendor').length

  const periodLabel = (p: Period) => {
    switch (p) {
      case 'day': return `Today (${today})`
      case 'week': return `This week (${weekStart} to ${weekEnd})`
      case 'month': return `This month (${monthStart} to ${monthEnd})`
      case 'custom': return 'Custom range'
    }
  }

  function PeriodSelector({ value, onChange, customStart, customEnd, onCustomStartChange, onCustomEndChange }: {
    value: Period; onChange: (p: Period) => void
    customStart: string; customEnd: string
    onCustomStartChange: (v: string) => void; onCustomEndChange: (v: string) => void
  }) {
    return (
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          {(['day', 'week', 'month', 'custom'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => onChange(p)}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '0.375rem',
                border: '1px solid',
                borderColor: value === p ? 'var(--color-primary)' : 'var(--color-border)',
                background: value === p ? 'var(--color-primary)' : 'transparent',
                color: value === p ? '#fff' : 'var(--color-text)',
                cursor: 'pointer',
                fontSize: '0.8125rem',
                fontWeight: 600,
              }}
            >
              {p === 'day' ? 'Day' : p === 'week' ? 'Week' : p === 'month' ? 'Month' : 'Custom'}
            </button>
          ))}
        </div>
        {value === 'custom' && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.875rem' }}>
            <input type="date" value={customStart} onChange={(e) => onCustomStartChange(e.target.value)}
              style={{ padding: '0.3rem 0.5rem', borderRadius: '0.375rem', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }} />
            <span style={{ color: 'var(--color-text-muted)' }}>to</span>
            <input type="date" value={customEnd} onChange={(e) => onCustomEndChange(e.target.value)}
              style={{ padding: '0.3rem 0.5rem', borderRadius: '0.375rem', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }} />
          </div>
        )}
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
          {periodLabel(value)}
        </p>
      </div>
    )
  }

  return (
    <>
      <Card className="content-card" title="Dashboard">
        <p className="content-subtitle">Overview for admin tasks.</p>

        {/* Summary */}
        <section style={{ marginBottom: '1.5rem' }}>
          <h3>Summary</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
            <li style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
              <strong style={{ color: 'var(--color-text)' }}>{users.length}</strong> users
              {personCount > 0 && <span> ({personCount} person{personCount !== 1 ? 's' : ''}, {vendorCount} vendor{vendorCount !== 1 ? 's' : ''})</span>}
            </li>
            <li style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <strong style={{ color: 'var(--color-text)' }}>{pendingFeedback}</strong> pending feedback
              {pendingFeedback > 0 && (
                <Link to="/admin/feedback"><Badge variant="warning">Review</Badge></Link>
              )}
            </li>
          </ul>
        </section>

        {/* Monthly Meal Cap */}
        <section style={{ marginBottom: '1.5rem' }}>
          <h3>Monthly Meal Price Cap</h3>
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem', background: 'var(--color-surface)' }}>
            {!capEditing ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
                    {settings.monthlyMealCap != null ? `₹${settings.monthlyMealCap}` : 'No cap set'}
                  </p>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                    {settings.monthlyMealCap != null ? 'Per user, per month' : 'Users can order unlimited meals'}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => { setCapInput(settings.monthlyMealCap != null ? String(settings.monthlyMealCap) : ''); setCapEditing(true) }}>
                  Edit
                </Button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="number"
                  placeholder="e.g. 500"
                  value={capInput}
                  onChange={(e) => setCapInput(e.target.value)}
                  style={{ padding: '0.4rem 0.5rem', borderRadius: '0.375rem', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', width: 120 }}
                />
                <Button size="sm" onClick={() => {
                  const val = capInput.trim() === '' ? null : parseFloat(capInput)
                  updateSettings(val)
                }} disabled={settingsPending}>
                  {settingsPending ? 'Saving…' : 'Save'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setCapEditing(false)}>Cancel</Button>
                {settings.monthlyMealCap != null && (
                  <Button size="sm" variant="danger" onClick={() => updateSettings(null)} disabled={settingsPending}>
                    Remove cap
                  </Button>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Expenses */}
        <section style={{ marginBottom: '1.5rem' }}>
          <h3>Expenses</h3>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {(['week', 'month'] as ExpenseMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setExpenseMode(mode)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid',
                    borderColor: expenseMode === mode ? 'var(--color-primary)' : 'var(--color-border)',
                    background: expenseMode === mode ? 'var(--color-primary)' : 'transparent',
                    color: expenseMode === mode ? '#fff' : 'var(--color-text)',
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                  }}
                >
                  {mode === 'week' ? 'Week' : 'Month'}
                </button>
              ))}
            </div>
            {expenseMode === 'week' ? (
              <select
                value={expenseWeekStart}
                onChange={(e) => setExpenseWeekStart(e.target.value)}
                style={{ padding: '0.35rem 0.5rem', borderRadius: '0.375rem', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '0.8125rem' }}
              >
                {weekOptions.map((w) => (
                  <option key={w.start} value={w.start}>{w.label}</option>
                ))}
              </select>
            ) : (
              <select
                value={expenseMonth}
                onChange={(e) => setExpenseMonth(e.target.value)}
                style={{ padding: '0.35rem 0.5rem', borderRadius: '0.375rem', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '0.8125rem' }}
              >
                {monthOptions.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            )}
          </div>
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem', background: 'var(--color-surface)' }}>
            {expenseOrdersLoading ? (
              <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>Loading…</p>
            ) : (
              <>
                <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>{formatMoney(expenseData.total)}</p>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                  from {expenseOrders.length} confirmed meal{expenseOrders.length !== 1 ? 's' : ''}
                  {expenseData.perPerson.length > 0 && <> · avg {formatMoney(expenseData.total / expenseData.perPerson.length)} per person</>}
                </p>
                {expenseData.perPerson.length > 0 && (
                  <ul style={{ listStyle: 'none', padding: 0, margin: '0.75rem 0 0', fontSize: '0.875rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.5rem' }}>
                    {expenseData.perPerson.map((p) => (
                      <li key={p.userId} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', padding: '0.2rem 0' }}>
                        <span>{p.userName}</span>
                        <span style={{ fontWeight: 500 }}>{formatMoney(p.total)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </section>

        {/* Dish Breakdown */}
        <section style={{ marginBottom: '1.5rem' }}>
          <h3>Dish-wise Breakdown</h3>
          <PeriodSelector
            value={dishPeriod} onChange={setDishPeriod}
            customStart={dishCustomStart} customEnd={dishCustomEnd}
            onCustomStartChange={setDishCustomStart} onCustomEndChange={setDishCustomEnd}
          />
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem', background: 'var(--color-surface)' }}>
            {dishOrdersLoading ? (
              <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>Loading…</p>
            ) : dishData.length === 0 ? (
              <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>No orders in this period.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ textAlign: 'left', padding: '0.4rem 0', color: 'var(--color-text-muted)', fontWeight: 600 }}>Dish</th>
                    <th style={{ textAlign: 'right', padding: '0.4rem 0', color: 'var(--color-text-muted)', fontWeight: 600 }}>Quantity</th>
                    <th style={{ textAlign: 'right', padding: '0.4rem 0', color: 'var(--color-text-muted)', fontWeight: 600 }}>Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {dishData.map((d, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '0.4rem 0' }}>{d.name}</td>
                      <td style={{ textAlign: 'right', padding: '0.4rem 0', fontWeight: 600 }}>{d.quantity}</td>
                      <td style={{ textAlign: 'right', padding: '0.4rem 0', color: 'var(--color-text-muted)' }}>{d.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <p style={{ margin: '0.5rem 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
          Based on confirmed orders and menu item prices. Edit prices in the menu to reflect actual costs.
        </p>
      </Card>
    </>
  )
}
