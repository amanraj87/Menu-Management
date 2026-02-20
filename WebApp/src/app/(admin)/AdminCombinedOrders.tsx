import { useState } from 'react'
import { Card, Button, Loader, Table, Thead, Tbody, Tr, Th, Td } from '@/shared/ui'
import type { MealType } from '@/shared/types'
import { useAggregatedOrder, useConfirmOrder } from '@/shared/graphql/hooks'
import { useToastStore } from '@/shared/stores/toastStore'

const MEALS: { id: MealType; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
]

function toDateString(d: Date) {
  return d.toISOString().slice(0, 10)
}

export function AdminCombinedOrders() {
  const [date, setDate] = useState(() => toDateString(new Date()))
  const [meal, setMeal] = useState<MealType>('lunch')
  const toast = useToastStore()

  const { aggregated, isLoading } = useAggregatedOrder(date, meal)
  const { confirmOrder, isPending: confirmPending } = useConfirmOrder(
    date,
    meal,
    () => toast.add('Order confirmed. Vendor can see it.', 'success'),
    (e) => toast.add(e.message, 'error')
  )

  if (isLoading) return <Loader />

  const items = aggregated?.items ?? []
  const hasItems = items.length > 0

  return (
    <Card title="Combined orders — confirm for vendor">
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>
        Select date and meal. See total quantity and who added what, then confirm so vendor sees the order.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input"
            style={{ minWidth: 160 }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Meal</label>
          <select
            value={meal}
            onChange={(e) => setMeal(e.target.value as MealType)}
            className="input"
            style={{ minWidth: 140 }}
          >
            {MEALS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>
      {!hasItems ? (
        <p style={{ color: 'var(--color-text-muted)' }}>No selections for this date and meal yet.</p>
      ) : (
        <>
          <Table>
            <Thead>
              <Tr>
                <Th>Item</Th>
                <Th>Unit</Th>
                <Th>Total qty</Th>
                <Th>Who added what</Th>
              </Tr>
            </Thead>
            <Tbody>
              {items.map((row) => (
                <Tr key={row.menuItemId}>
                  <Td>{row.name}</Td>
                  <Td>{row.unit}</Td>
                  <Td>{row.quantity}</Td>
                  <Td>
                    <span style={{ fontSize: '0.875rem' }}>
                      {row.personBreakdown.map((p) => `${p.userName}: ${p.quantity}`).join(', ')}
                    </span>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          <Button
            onClick={() => confirmOrder()}
            disabled={confirmPending}
            style={{ marginTop: '1rem' }}
          >
            {confirmPending ? 'Confirming…' : 'Confirm order'}
          </Button>
        </>
      )}
    </Card>
  )
}
