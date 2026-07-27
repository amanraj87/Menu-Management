import { useState } from 'react'
import { Card, Tabs, Loader } from '@/shared/ui'
import type { TabItem } from '@/shared/ui'
import type { MealType, MenuItem } from '@/shared/types'
import { useMenuItems, useSetMenuItemOffered } from '@/shared/graphql/hooks'
import { useToastStore } from '@/shared/stores/toastStore'

const MEALS: { id: MealType; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
]

export function AdminMenuManager() {
  const [mealTab, setMealTab] = useState<MealType>('breakfast')
  const { items: allItems, isLoading } = useMenuItems()
  const { setOffered } = useSetMenuItemOffered()
  const toast = useToastStore()
  const [pending, setPending] = useState<Set<string>>(new Set())

  const items = allItems
    .filter((i: MenuItem) => i.mealType === mealTab)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  const availableCount = items.filter((i) => i.offered).length

  const toggle = async (item: MenuItem) => {
    setPending((prev) => new Set(prev).add(item._id))
    try {
      await setOffered(item._id, !item.offered)
    } catch (e) {
      toast.add((e as Error).message, 'error')
    } finally {
      setPending((prev) => {
        const next = new Set(prev)
        next.delete(item._id)
        return next
      })
    }
  }

  const content = isLoading ? (
    <Loader />
  ) : items.length === 0 ? (
    <div className="menu-empty">
      <p className="menu-empty__icon">🍽️</p>
      <p style={{ margin: 0 }}>No dishes for this meal yet. The vendor adds dishes from their Menu page.</p>
    </div>
  ) : (
    <>
      <div className="offer-summary">
        <strong>{availableCount}</strong> of {items.length} available to users
      </div>
      <div className="menu-list">
        {items.map((item) => (
          <div key={item._id} className="menu-row">
            <span className="menu-row__name">
              {item.name}
              {!item.offered && <span className="offer-hidden-tag">Hidden</span>}
            </span>
            <span className="menu-row__price">
              {item.pricePerUnit != null ? (
                <>
                  <span className="amount">₹{item.pricePerUnit}</span>{' '}
                  <span className="unit">/{item.unit}</span>
                </>
              ) : (
                <span className="amount--none">—</span>
              )}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={item.offered}
              aria-label={`${item.offered ? 'Hide' : 'Show'} ${item.name} for users`}
              className={`switch ${item.offered ? 'switch--on' : ''}`}
              onClick={() => toggle(item)}
              disabled={pending.has(item._id)}
            >
              <span className="switch__thumb" />
            </button>
          </div>
        ))}
      </div>
    </>
  )

  const tabs: TabItem[] = MEALS.map((m) => ({
    id: m.id,
    label: m.label,
    content: mealTab === m.id ? content : <div />,
  }))

  return (
    <Card className="content-card" title="Menu — what users can choose">
      <p className="content-subtitle">
        Turn dishes on or off for each meal. Only dishes that are on will appear when users plan their meals.
      </p>
      <Tabs tabs={tabs} activeId={mealTab} onSelect={(id) => setMealTab(id as MealType)} />
    </Card>
  )
}
