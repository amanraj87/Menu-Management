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

  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const selectionKey = selection != null ? JSON.stringify(selection.items.map((i) => [i.menuItemId, i.quantity])) : ''
  const menuIdsKey = menuItems.map((m) => m._id).join(',')

  useEffect(() => {
    const items = selection?.items ?? []
    const selectionByItem = new Map(items.map((i) => [i.menuItemId, i.quantity]))
    const next: Record<string, number> = {}
    menuItems.forEach((item: MenuItem) => {
      next[item._id] = selectionByItem.get(item._id) ?? 0
    })
    setQuantities(next)
  }, [date, mealTab, selectionKey, menuIdsKey])

  const [draftQty, setDraftQty] = useState<Record<string, string>>({})

  const handleQty = (menuItemId: string, qty: number) => {
    if (qty < 0) return
    setQuantities((prev) => ({ ...prev, [menuItemId]: qty }))
    setDraftQty((prev) => { const next = { ...prev }; delete next[menuItemId]; return next })
  }

  const commitDraftQty = (menuItemId: string) => {
    const raw = draftQty[menuItemId]
    setDraftQty((prev) => { const next = { ...prev }; delete next[menuItemId]; return next })
    if (raw === undefined || raw === '') {
      setQuantities((prev) => ({ ...prev, [menuItemId]: 0 }))
      return
    }
    const v = Number(raw)
    setQuantities((prev) => ({ ...prev, [menuItemId]: Number.isNaN(v) || v < 0 ? 0 : v }))
  }

  const handleSave = () => {
    const items = menuItems
      .filter((m: MenuItem) => (quantities[m._id] ?? 0) > 0)
      .map((m: MenuItem) => ({ menuItemId: m._id, quantity: quantities[m._id] ?? 0 }))
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    aria-label="Decrease"
                    onClick={() => handleQty(item._id, Math.max(0, (quantities[item._id] ?? 0) - 1))}
                  >
                    −
                  </button>
                          <input
                            type="number"
                            min={0}
                            step="0.1"
                            inputMode="decimal"
                            aria-label="Quantity"
                            value={draftQty[item._id] ?? quantities[item._id] ?? 0}
                            onChange={(e) => setDraftQty((prev) => ({ ...prev, [item._id]: e.target.value }))}
                            onBlur={() => commitDraftQty(item._id)}
                            className="input input-qty"
                            style={{ width: 52, textAlign: 'center' }}
                          />
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    aria-label="Increase"
                    onClick={() => handleQty(item._id, (quantities[item._id] ?? 0) + 1)}
                  >
                    +
                  </button>
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
