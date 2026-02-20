import { useState, useEffect } from 'react'
import { Card, Tabs, Button, Loader } from '@/shared/ui'
import type { TabItem } from '@/shared/ui'
import type { MealType, MenuItem } from '@/shared/types'
import { useMenuItems, useMySelection, usePutSelection } from '@/shared/graphql/hooks'
import { useToastStore } from '@/shared/stores/toastStore'

const MEALS: { id: MealType; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
]

function toDateString(d: Date) {
  return d.toISOString().slice(0, 10)
}

export function PersonChooseMeals() {
  const [date, setDate] = useState(() => toDateString(new Date()))
  const [mealTab, setMealTab] = useState<MealType>('breakfast')
  const toast = useToastStore()

  const { items: menuItems, isLoading: menuLoading } = useMenuItems(mealTab)
  const { selection, isLoading: selectionLoading } = useMySelection(date, mealTab)
  const { putSelection, isPending: putPending } = usePutSelection(date, mealTab, () => toast.add('Saved.', 'success'), (e) => toast.add(e.message, 'error'))

  const currentSelection = selection?.items ?? []
  const selectionByItem = new Map(currentSelection.map((i) => [i.menuItemId, i.quantity]))

  const [quantities, setQuantities] = useState<Record<string, number>>({})
  useEffect(() => {
    const next: Record<string, number> = {}
    menuItems.forEach((item: MenuItem) => {
      next[item._id] = quantities[item._id] ?? selectionByItem.get(item._id) ?? item.defaultQuantity ?? 1
    })
    setQuantities((prev) => ({ ...prev, ...next }))
  }, [menuItems, selectionByItem])

  const handleQty = (menuItemId: string, qty: number) => {
    if (qty < 1) return
    setQuantities((prev) => ({ ...prev, [menuItemId]: qty }))
  }

  const handleSave = () => {
    const items = menuItems
      .filter((m: MenuItem) => (quantities[m._id] ?? 0) > 0)
      .map((m: MenuItem) => ({ menuItemId: m._id, quantity: quantities[m._id] ?? 1 }))
    putSelection(items)
  }

  const hasSelection = menuItems.some((m: MenuItem) => (quantities[m._id] ?? 0) > 0)

  const content = (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="input"
          style={{ width: '100%', maxWidth: 200 }}
        />
      </div>
      {menuLoading || selectionLoading ? (
        <Loader />
      ) : menuItems.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>No menu items for this meal yet. Ask vendor to add items.</p>
      ) : (
        <>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {menuItems.map((item: MenuItem) => (
              <li
                key={item._id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                <span>{item.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="number"
                    min={0}
                    value={quantities[item._id] ?? 0}
                    onChange={(e) => handleQty(item._id, Number(e.target.value) || 0)}
                    className="input"
                    style={{ width: 64, textAlign: 'center' }}
                  />
                  <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{item.unit}</span>
                </div>
              </li>
            ))}
          </ul>
          <Button onClick={handleSave} disabled={!hasSelection || putPending} style={{ marginTop: '1rem' }}>
            {putPending ? 'Saving…' : 'Save my choices'}
          </Button>
        </>
      )}
    </div>
  )

  const tabs: TabItem[] = MEALS.map((m) => ({
    id: m.id,
    label: m.label,
    content: mealTab === m.id ? content : <div />,
  }))

  return (
    <Card title="Choose your food">
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>
        Pick items and quantity for each meal. Admin will see combined orders and confirm.
      </p>
      <Tabs tabs={tabs} activeId={mealTab} onSelect={(id) => setMealTab(id as MealType)} />
    </Card>
  )
}
