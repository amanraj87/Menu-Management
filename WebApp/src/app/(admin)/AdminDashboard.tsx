import { useMemo } from 'react'
import { Card, Badge, Loader } from '@/shared/ui'
import { Link } from 'react-router-dom'
import { useUsers, useFeedbacksForAdmin, useConfirmedOrders, useMenuItems } from '@/shared/graphql/hooks'
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

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return toDateString(d)
}

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

function formatMoney(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) : '0.00'
}

function getMonthDates(today: string): string[] {
  const year = parseInt(today.slice(0, 4), 10)
  const month = parseInt(today.slice(5, 7), 10)
  const daysInMonth = new Date(year, month, 0).getDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  const out: string[] = []
  for (let d = 1; d <= 31; d++) {
    out.push(d <= daysInMonth ? `${year}-${pad(month)}-${pad(d)}` : '2099-12-31')
  }
  return out
}

export function AdminDashboard() {
  const today = toDateString(new Date())
  const weekStart = getWeekStart(today)
  const weekDates = useMemo(() => [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(weekStart, i)), [weekStart])
  const monthDates = useMemo(() => getMonthDates(today), [today])

  const { users, isLoading: usersLoading } = useUsers()
  const { feedbacks, isLoading: feedbackLoading } = useFeedbacksForAdmin()
  const { items: menuItems, isLoading: menuLoading } = useMenuItems()
  const { orders: todayOrders, isLoading: ordersTodayLoading } = useConfirmedOrders(today)
  const { orders: ordersD0 } = useConfirmedOrders(weekDates[0])
  const { orders: ordersD1 } = useConfirmedOrders(weekDates[1])
  const { orders: ordersD2 } = useConfirmedOrders(weekDates[2])
  const { orders: ordersD3 } = useConfirmedOrders(weekDates[3])
  const { orders: ordersD4 } = useConfirmedOrders(weekDates[4])
  const { orders: ordersD5 } = useConfirmedOrders(weekDates[5])
  const { orders: ordersD6 } = useConfirmedOrders(weekDates[6])
  const { orders: monthD0 } = useConfirmedOrders(monthDates[0])
  const { orders: monthD1 } = useConfirmedOrders(monthDates[1])
  const { orders: monthD2 } = useConfirmedOrders(monthDates[2])
  const { orders: monthD3 } = useConfirmedOrders(monthDates[3])
  const { orders: monthD4 } = useConfirmedOrders(monthDates[4])
  const { orders: monthD5 } = useConfirmedOrders(monthDates[5])
  const { orders: monthD6 } = useConfirmedOrders(monthDates[6])
  const { orders: monthD7 } = useConfirmedOrders(monthDates[7])
  const { orders: monthD8 } = useConfirmedOrders(monthDates[8])
  const { orders: monthD9 } = useConfirmedOrders(monthDates[9])
  const { orders: monthD10 } = useConfirmedOrders(monthDates[10])
  const { orders: monthD11 } = useConfirmedOrders(monthDates[11])
  const { orders: monthD12 } = useConfirmedOrders(monthDates[12])
  const { orders: monthD13 } = useConfirmedOrders(monthDates[13])
  const { orders: monthD14 } = useConfirmedOrders(monthDates[14])
  const { orders: monthD15 } = useConfirmedOrders(monthDates[15])
  const { orders: monthD16 } = useConfirmedOrders(monthDates[16])
  const { orders: monthD17 } = useConfirmedOrders(monthDates[17])
  const { orders: monthD18 } = useConfirmedOrders(monthDates[18])
  const { orders: monthD19 } = useConfirmedOrders(monthDates[19])
  const { orders: monthD20 } = useConfirmedOrders(monthDates[20])
  const { orders: monthD21 } = useConfirmedOrders(monthDates[21])
  const { orders: monthD22 } = useConfirmedOrders(monthDates[22])
  const { orders: monthD23 } = useConfirmedOrders(monthDates[23])
  const { orders: monthD24 } = useConfirmedOrders(monthDates[24])
  const { orders: monthD25 } = useConfirmedOrders(monthDates[25])
  const { orders: monthD26 } = useConfirmedOrders(monthDates[26])
  const { orders: monthD27 } = useConfirmedOrders(monthDates[27])
  const { orders: monthD28 } = useConfirmedOrders(monthDates[28])
  const { orders: monthD29 } = useConfirmedOrders(monthDates[29])
  const { orders: monthD30 } = useConfirmedOrders(monthDates[30])

  const pendingFeedback = feedbacks.filter((f) => f.status === 'pending').length
  const isLoading = usersLoading || feedbackLoading || menuLoading || ordersTodayLoading

  const priceByMenuId = useMemo(() => {
    const map: Record<string, number> = {}
    for (const m of menuItems) {
      if (m.pricePerUnit != null && Number.isFinite(m.pricePerUnit)) {
        map[m._id] = m.pricePerUnit
      }
    }
    return map
  }, [menuItems])

  const todayExpense = useMemo(
    () => computeExpense(todayOrders, priceByMenuId),
    [todayOrders, priceByMenuId]
  )
  const weekOrders = useMemo(
    () => [...ordersD0, ...ordersD1, ...ordersD2, ...ordersD3, ...ordersD4, ...ordersD5, ...ordersD6],
    [ordersD0, ordersD1, ordersD2, ordersD3, ordersD4, ordersD5, ordersD6]
  )
  const weekExpense = useMemo(
    () => computeExpense(weekOrders, priceByMenuId),
    [weekOrders, priceByMenuId]
  )
  const monthOrders = useMemo(
    () => [
      ...monthD0, ...monthD1, ...monthD2, ...monthD3, ...monthD4, ...monthD5, ...monthD6,
      ...monthD7, ...monthD8, ...monthD9, ...monthD10, ...monthD11, ...monthD12, ...monthD13, ...monthD14,
      ...monthD15, ...monthD16, ...monthD17, ...monthD18, ...monthD19, ...monthD20, ...monthD21,
      ...monthD22, ...monthD23, ...monthD24, ...monthD25, ...monthD26, ...monthD27, ...monthD28,
      ...monthD29, ...monthD30,
    ],
    [monthD0, monthD1, monthD2, monthD3, monthD4, monthD5, monthD6, monthD7, monthD8, monthD9,
      monthD10, monthD11, monthD12, monthD13, monthD14, monthD15, monthD16, monthD17, monthD18, monthD19,
      monthD20, monthD21, monthD22, monthD23, monthD24, monthD25, monthD26, monthD27, monthD28, monthD29, monthD30]
  )
  const monthExpense = useMemo(
    () => computeExpense(monthOrders, priceByMenuId),
    [monthOrders, priceByMenuId]
  )

  if (isLoading) return <Loader />

  const personCount = users.filter((u) => u.role === 'person').length
  const vendorCount = users.filter((u) => u.role === 'vendor').length
  const todayMealsCount = todayOrders.length
  const weekMealsCount = weekOrders.length
  const monthMealsCount = monthOrders.length
  const monthLabel = (() => {
    const d = new Date(today + 'T12:00:00')
    return d.toLocaleString('default', { month: 'long', year: 'numeric' })
  })()

  return (
    <>
      <Card title="Dashboard">
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>
          Overview for admin tasks.
        </p>

        <section style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '0.9375rem', marginBottom: '0.5rem', fontWeight: 600 }}>Today</h3>
          <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            {today} · {todayMealsCount} meal order{todayMealsCount !== 1 ? 's' : ''} confirmed for today
          </p>
        </section>

        <section style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '0.9375rem', marginBottom: '0.5rem', fontWeight: 600 }}>Expenses</h3>
          <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem', background: 'var(--color-surface)' }}>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Today</h4>
              <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>{formatMoney(todayExpense.total)}</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                total from {todayMealsCount} confirmed meal{todayMealsCount !== 1 ? 's' : ''}
              </p>
              {todayExpense.perPerson.length > 0 && (
                <ul style={{ listStyle: 'none', padding: 0, margin: '0.75rem 0 0', fontSize: '0.875rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.5rem' }}>
                  {todayExpense.perPerson.map((p) => (
                    <li key={p.userId} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', padding: '0.2rem 0' }}>
                      <span>{p.userName}</span>
                      <span style={{ fontWeight: 500 }}>{formatMoney(p.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem', background: 'var(--color-surface)' }}>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>This week (Mon–Sun)</h4>
              <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>{formatMoney(weekExpense.total)}</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                total from {weekMealsCount} confirmed meal{weekMealsCount !== 1 ? 's' : ''}
                {weekExpense.perPerson.length > 0 && (
                  <> · avg {formatMoney(weekExpense.total / weekExpense.perPerson.length)} per person</>
                )}
              </p>
              {weekExpense.perPerson.length > 0 && (
                <ul style={{ listStyle: 'none', padding: 0, margin: '0.75rem 0 0', fontSize: '0.875rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.5rem' }}>
                  {weekExpense.perPerson.map((p) => (
                    <li key={p.userId} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', padding: '0.2rem 0' }}>
                      <span>{p.userName}</span>
                      <span style={{ fontWeight: 500 }}>{formatMoney(p.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem', background: 'var(--color-surface)' }}>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>This month ({monthLabel})</h4>
              <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>{formatMoney(monthExpense.total)}</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                total from {monthMealsCount} confirmed meal{monthMealsCount !== 1 ? 's' : ''}
                {monthExpense.perPerson.length > 0 && (
                  <> · avg {formatMoney(monthExpense.total / monthExpense.perPerson.length)} per person</>
                )}
              </p>
              {monthExpense.perPerson.length > 0 && (
                <ul style={{ listStyle: 'none', padding: 0, margin: '0.75rem 0 0', fontSize: '0.875rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.5rem' }}>
                  {monthExpense.perPerson.map((p) => (
                    <li key={p.userId} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', padding: '0.2rem 0' }}>
                      <span>{p.userName}</span>
                      <span style={{ fontWeight: 500 }}>{formatMoney(p.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            Based on confirmed orders and menu item prices. Edit prices in the menu to reflect actual costs.
          </p>
        </section>

        <section style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '0.9375rem', marginBottom: '0.5rem', fontWeight: 600 }}>Summary</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
            <li style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
              <strong style={{ color: 'var(--color-text)' }}>{users.length}</strong> users
              {personCount > 0 && <span> ({personCount} person{personCount !== 1 ? 's' : ''}, {vendorCount} vendor{vendorCount !== 1 ? 's' : ''})</span>}
            </li>
            <li style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <strong style={{ color: 'var(--color-text)' }}>{pendingFeedback}</strong> pending feedback
              {pendingFeedback > 0 && (
                <Link to="/admin/feedback">
                  <Badge variant="warning">Review</Badge>
                </Link>
              )}
            </li>
          </ul>
        </section>
      </Card>
    </>
  )
}
