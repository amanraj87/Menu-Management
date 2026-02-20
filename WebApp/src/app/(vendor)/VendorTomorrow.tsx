import { useConfirmedOrders } from '@/shared/graphql/hooks'
import { Card, Loader } from '@/shared/ui'
import { Link } from 'react-router-dom'
import type { ConfirmedOrder } from '@/shared/types'

function toDateString(d: Date) {
  return d.toISOString().slice(0, 10)
}

export function VendorTomorrow() {
  const tomorrow = toDateString(new Date(Date.now() + 86400000))
  const { orders, isLoading } = useConfirmedOrders(tomorrow)

  const flatItems = orders.flatMap((o: ConfirmedOrder) =>
    o.items.map((i: { name: string; quantity: number; unit: string }) => ({ name: i.name, quantity: i.quantity, unit: i.unit }))
  )

  if (isLoading) return <Loader />

  return (
    <>
      <Card title="Tomorrow expected order">
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>
          Preview for {tomorrow}. Admin must confirm orders for them to appear here.
        </p>
        {flatItems.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)' }}>No orders confirmed for tomorrow yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {flatItems.map((item: { name: string; quantity: number; unit: string }, i: number) => (
              <li key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)' }}>
                <span>{item.name}</span>
                <span>{item.quantity} {item.unit}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p style={{ marginTop: '1rem', textAlign: 'center' }}>
        <Link to="/vendor" style={{ color: 'var(--color-primary)' }}>← Today&apos;s order</Link>
      </p>
    </>
  )
}
