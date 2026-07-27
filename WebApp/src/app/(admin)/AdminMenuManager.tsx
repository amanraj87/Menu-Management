import { useState } from 'react'
import { Card, Tabs, Loader } from '@/shared/ui'
import type { TabItem } from '@/shared/ui'
import type { MealType, MenuItem } from '@/shared/types'
import { useMenuItems, useSetMenuItemOfferedDays } from '@/shared/graphql/hooks'
import { useToastStore } from '@/shared/stores/toastStore'

const MEALS: { id: MealType; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
]

// Display order Mon → Sun; values are JS weekdays (0=Sun … 6=Sat).
const WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
]

export function AdminMenuManager() {
  const [mealTab, setMealTab] = useState<MealType>('breakfast')
  const { items: allItems, isLoading } = useMenuItems()
  const { setOfferedDays } = useSetMenuItemOfferedDays()
  const toast = useToastStore()
  // Optimistic overrides so chips flip instantly before the refetch lands.
  const [overrides, setOverrides] = useState<Record<string, number[]>>({})
  const [pending, setPending] = useState<Set<string>>(new Set())

  const items = allItems
    .filter((i: MenuItem) => i.mealType === mealTab)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

  const daysOf = (item: MenuItem): number[] => overrides[item._id] ?? item.offeredDays

  const save = async (item: MenuItem, next: number[]) => {
    const prevDays = daysOf(item)
    setOverrides((o) => ({ ...o, [item._id]: next }))
    setPending((p) => new Set(p).add(item._id))
    try {
      await setOfferedDays(item._id, next)
    } catch (e) {
      setOverrides((o) => ({ ...o, [item._id]: prevDays })) // revert
      toast.add((e as Error).message, 'error')
    } finally {
      setPending((p) => {
        const n = new Set(p)
        n.delete(item._id)
        return n
      })
    }
  }

  const toggleDay = (item: MenuItem, day: number) => {
    const days = daysOf(item)
    const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort((a, b) => a - b)
    void save(item, next)
  }

  const content = isLoading ? (
    <Loader />
  ) : items.length === 0 ? (
    <div className="menu-empty">
      <p className="menu-empty__icon">🍽️</p>
      <p style={{ margin: 0 }}>No dishes for this meal yet. The vendor adds dishes from their Menu page.</p>
    </div>
  ) : (
    <div className="offer-list">
      {items.map((item) => {
        const days = daysOf(item)
        const busy = pending.has(item._id)
        return (
          <div key={item._id} className={`offer-item${days.length === 0 ? ' offer-item--off' : ''}`}>
            <div className="offer-item__head">
              <span className="offer-item__name">{item.name}</span>
              <span className="offer-item__price">
                {item.pricePerUnit != null ? <><span className="amount">₹{item.pricePerUnit}</span> <span className="unit">/{item.unit}</span></> : <span className="amount--none">—</span>}
              </span>
            </div>
            <div className="offer-item__days">
              {WEEKDAYS.map((d) => {
                const on = days.includes(d.value)
                return (
                  <button
                    key={d.value}
                    type="button"
                    className={`day-chip${on ? ' day-chip--on' : ''}`}
                    aria-pressed={on}
                    disabled={busy}
                    onClick={() => toggleDay(item, d.value)}
                  >
                    {d.label}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )

  const tabs: TabItem[] = MEALS.map((m) => ({
    id: m.id,
    label: m.label,
    content: mealTab === m.id ? content : <div />,
  }))

  return (
    <Card className="content-card" title="Menu — what users can choose">
      <p className="content-subtitle">
        Pick which days of the week each dish is available. Users can only choose a dish on the days it&apos;s turned on.
      </p>
      <Tabs tabs={tabs} activeId={mealTab} onSelect={(id) => setMealTab(id as MealType)} />
    </Card>
  )
}
