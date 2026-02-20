import { useQuery } from '@tanstack/react-query'
import { Card, Loader } from '@/shared/ui'
import { Link } from 'react-router-dom'
import { api } from '@/shared/api/client'

function toDateString(d: Date) {
  return d.toISOString().slice(0, 10)
}

function MealBlock({ title, items }: { title: string; items: { name: string; quantity: number; unit: string }[] }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', color: 'var(--color-text-muted)' }}>{title}</h3>
      {items.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>No order confirmed yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {items.map((item) => (
            <li key={item.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)' }}>
              <span>{item.name}</span>
              <span>{item.quantity} {item.unit}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function VendorToday() {
  const today = toDateString(new Date())
  const { data, isLoading } = useQuery({
    queryKey: ['orders-confirmed', today],
    queryFn: () => api.getConfirmedOrders(today),
  })

  const orders = data?.orders ?? []
  const byMeal = orders.reduce<Record<string, { name: string; quantity: number; unit: string }[]>>((acc, o) => {
    acc[o.mealType] = o.items.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit }))
    return acc
  }, {})

  if (isLoading) return <Loader />

  return (
    <>
      <Card title={`TODAY — ${today}`}>
        <MealBlock title="BREAKFAST" items={byMeal.breakfast ?? []} />
        <MealBlock title="LUNCH" items={byMeal.lunch ?? []} />
        <MealBlock title="DINNER" items={byMeal.dinner ?? []} />
      </Card>
      <p style={{ marginTop: '1rem', textAlign: 'center' }}>
        <Link to="/vendor/tomorrow" style={{ color: 'var(--color-primary)' }}>Tomorrow expected order →</Link>
        {' · '}
        <Link to="/vendor/menu" style={{ color: 'var(--color-primary)' }}>Update menu</Link>
      </p>
    </>
  )
}
