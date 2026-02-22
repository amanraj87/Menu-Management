import { useConfirmedOrders } from '@/shared/graphql/hooks'
import { Card, Loader } from '@/shared/ui'
import { Link } from 'react-router-dom'
import type { ConfirmedOrder } from '@/shared/types'

function toDateString(d: Date) {
  return d.toISOString().slice(0, 10)
}

function addDays(date: Date, n: number) {
  const out = new Date(date)
  out.setDate(out.getDate() + n)
  return out
}

function MealBlock({ title, items }: { title: string; items: { name: string; quantity: number; unit: string }[] }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem', color: 'var(--color-text-muted)' }}>{title}</h3>
      {items.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>No order confirmed.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {items.map((item) => (
            <li key={item.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid var(--color-border)', fontSize: '0.875rem' }}>
              <span>{item.name}</span>
              <span>{item.quantity} {item.unit}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ordersToByMeal(orders: ConfirmedOrder[]): Record<string, { name: string; quantity: number; unit: string }[]> {
  return orders.reduce<Record<string, { name: string; quantity: number; unit: string }[]>>((acc, o) => {
    acc[o.mealType] = o.items.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit }))
    return acc
  }, {})
}

const MEALS = ['breakfast', 'lunch', 'dinner'] as const

export function VendorWeekView() {
  const base = new Date()
  const dates = [0, 1, 2, 3, 4, 5, 6].map((n) => toDateString(addDays(base, n)))

  const { orders: orders0, isLoading: loading0 } = useConfirmedOrders(dates[0])
  const { orders: orders1, isLoading: loading1 } = useConfirmedOrders(dates[1])
  const { orders: orders2, isLoading: loading2 } = useConfirmedOrders(dates[2])
  const { orders: orders3, isLoading: loading3 } = useConfirmedOrders(dates[3])
  const { orders: orders4, isLoading: loading4 } = useConfirmedOrders(dates[4])
  const { orders: orders5, isLoading: loading5 } = useConfirmedOrders(dates[5])
  const { orders: orders6, isLoading: loading6 } = useConfirmedOrders(dates[6])

  const allOrders = [orders0, orders1, orders2, orders3, orders4, orders5, orders6]
  const isLoading = loading0 || loading1 || loading2 || loading3 || loading4 || loading5 || loading6

  if (isLoading) return <Loader />

  return (
    <>
      <Card className="content-card" title="Week — food items by day">
        <p className="content-subtitle">
          Confirmed orders for the next 7 days. Admin must confirm orders for each date for them to appear.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
          {dates.map((dateStr, i) => {
            const byMeal = ordersToByMeal(allOrders[i])
            return (
              <div key={dateStr} style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem', background: 'var(--color-surface)' }}>
                <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: 'var(--color-text)' }}>{dateStr}</h2>
                {MEALS.map((meal) => (
                  <MealBlock key={meal} title={meal.toUpperCase()} items={byMeal[meal] ?? []} />
                ))}
              </div>
            )
          })}
        </div>
      </Card>
      <p style={{ marginTop: '1rem', textAlign: 'center' }}>
        <Link to="/vendor" style={{ color: 'var(--color-primary)' }}>Today&apos;s order</Link>
        {' · '}
        <Link to="/vendor/menu" style={{ color: 'var(--color-primary)' }}>Update menu</Link>
      </p>
    </>
  )
}
