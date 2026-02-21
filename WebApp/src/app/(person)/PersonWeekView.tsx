import { useState, useEffect } from 'react'
import { Card, Button, Loader } from '@/shared/ui'
import type { MealType, MenuItem } from '@/shared/types'
import { useMutation } from '@apollo/client/react'
import { useMenuItems, useMySelectionsForWeek } from '@/shared/graphql/hooks'
import { useApolloClient } from '@apollo/client/react'
import { MY_SELECTIONS_FOR_WEEK, PUT_SELECTION } from '@/shared/graphql/operations'
import { useToastStore } from '@/shared/stores/toastStore'

const MEALS: { id: MealType; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
]
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function toDateString(d: Date) {
  return d.toISOString().slice(0, 10)
}

/** Monday of the week containing the given date (YYYY-MM-DD) */
function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return toDateString(d)
}

/** Add N days to a date string (YYYY-MM-DD), return YYYY-MM-DD */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return toDateString(d)
}

function qtyKey(date: string, mealType: MealType, menuItemId: string) {
  return `${date}-${mealType}-${menuItemId}`
}

export function PersonWeekView() {
  const [weekOf, setWeekOf] = useState(() => getWeekStart(toDateString(new Date())))
  const startDate = getWeekStart(weekOf)
  const toast = useToastStore()
  const client = useApolloClient()

  const { items: allMenuItems, isLoading: menuLoading } = useMenuItems()
  const { selections, isLoading: weekLoading } = useMySelectionsForWeek(startDate)
  const [quantities, setQuantities] = useState<Record<string, number>>({})

  const selectionsKey = JSON.stringify(selections.map((s) => [s.date, s.mealType, s.items.map((i) => [i.menuItemId, i.quantity])]))
  useEffect(() => {
    const next: Record<string, number> = {}
    selections.forEach((s) => {
      s.items.forEach((i) => {
        next[qtyKey(s.date, s.mealType as MealType, i.menuItemId)] = i.quantity
      })
    })
    setQuantities((prev) => ({ ...prev, ...next }))
  }, [selectionsKey])

  const menuByMeal = {
    breakfast: allMenuItems.filter((m: MenuItem) => m.mealType === 'breakfast'),
    lunch: allMenuItems.filter((m: MenuItem) => m.mealType === 'lunch'),
    dinner: allMenuItems.filter((m: MenuItem) => m.mealType === 'dinner'),
  }

  const [draftQty, setDraftQty] = useState<Record<string, string>>({})

  const handleQty = (date: string, mealType: MealType, menuItemId: string, qty: number) => {
    if (qty < 0) return
    const key = qtyKey(date, mealType, menuItemId)
    setQuantities((prev) => ({ ...prev, [key]: qty }))
    setDraftQty((prev) => { const next = { ...prev }; delete next[key]; return next })
  }

  const commitDraft = (key: string) => {
    const raw = draftQty[key]
    setDraftQty((prev) => { const next = { ...prev }; delete next[key]; return next })
    if (raw === undefined || raw === '') {
      setQuantities((prev) => ({ ...prev, [key]: 0 }))
      return
    }
    const v = Number(raw)
    setQuantities((prev) => ({ ...prev, [key]: Number.isNaN(v) || v < 0 ? 0 : v }))
  }

  const [putSelectionMutate] = useMutation(PUT_SELECTION, {
    onError: (e) => toast.add(e.message, 'error'),
  })
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)

  const handleImportFromLastWeek = async () => {
    const lastWeekStart = addDays(startDate, -7)
    setImporting(true)
    try {
      const result = await client.query<{ mySelectionsForWeek: Array<{ date: string; mealType: string; items: { menuItemId: string; quantity: number }[] }> }>({
        query: MY_SELECTIONS_FOR_WEEK,
        variables: { startDate: lastWeekStart },
      })
      const lastWeekSelections = result.data?.mySelectionsForWeek ?? []
      const lastWeekDates: string[] = []
      for (let i = 0; i < 7; i++) {
        lastWeekDates.push(addDays(lastWeekStart, i))
      }
      const imported: Record<string, number> = {}
      for (const s of lastWeekSelections) {
        const dayIndex = lastWeekDates.indexOf(s.date)
        if (dayIndex === -1) continue
        const targetDate = weekDates[dayIndex]
        for (const item of s.items) {
          if (item.quantity > 0) {
            imported[qtyKey(targetDate, s.mealType as MealType, item.menuItemId)] = item.quantity
          }
        }
      }
      setQuantities((prev) => ({ ...prev, ...imported }))
      toast.add('Last week\'s selections imported into this week.', 'success')
    } catch (e) {
      toast.add(e instanceof Error ? e.message : 'Failed to import last week', 'error')
    } finally {
      setImporting(false)
    }
  }

  const handleSaveWeek = async () => {
    setSaving(true)
    const dates: string[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate + 'T12:00:00')
      d.setDate(d.getDate() + i)
      dates.push(toDateString(d))
    }
    for (const date of dates) {
      for (const meal of MEALS) {
        const mealItems = menuByMeal[meal.id]
        const items = mealItems
          .filter((m: MenuItem) => (quantities[qtyKey(date, meal.id, m._id)] ?? 0) > 0)
          .map((m: MenuItem) => ({ menuItemId: m._id, quantity: quantities[qtyKey(date, meal.id, m._id)] ?? 0 }))
        await putSelectionMutate({ variables: { input: { date, mealType: meal.id, items } } }).catch(() => {})
      }
    }
    await client.refetchQueries({ include: [MY_SELECTIONS_FOR_WEEK] })
    setSaving(false)
    toast.add('Week saved.', 'success')
  }

  const weekDates = (() => {
    const out: string[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate + 'T12:00:00')
      d.setDate(d.getDate() + i)
      out.push(toDateString(d))
    }
    return out
  })()

  if (menuLoading || weekLoading) return <Loader />

  return (
    <Card title="My week — choose meals for each day">
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>
        Set your choices for each day of the week. You can edit any day and save once.
      </p>
      <div style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '0.75rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Week of</label>
          <input
            type="date"
            value={weekOf}
            onChange={(e) => setWeekOf(e.target.value)}
            className="input"
            style={{ width: '100%', maxWidth: 200 }}
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={handleImportFromLastWeek}
          disabled={importing}
        >
          {importing ? 'Importing…' : 'Import from last week'}
        </Button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {weekDates.map((dateStr, dayIndex) => (
          <div
            key={dateStr}
            style={{
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              padding: '1rem',
              background: 'var(--color-surface)',
            }}
          >
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>
              {DAY_NAMES[dayIndex]} — {dateStr}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '1.5rem', flexWrap: 'wrap' }}>
            {MEALS.map((meal) => {
              const allMealItems = menuByMeal[meal.id]
              const selectedItems = allMealItems.filter(
                (item: MenuItem) => (quantities[qtyKey(dateStr, meal.id, item._id)] ?? 0) > 0
              )
              const unselectedItems = allMealItems.filter(
                (item: MenuItem) => (quantities[qtyKey(dateStr, meal.id, item._id)] ?? 0) === 0
              )
              return (
                <div key={meal.id} style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                    {meal.label}
                  </h4>
                  {selectedItems.length === 0 ? (
                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>
                      No items selected.
                    </p>
                  ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {selectedItems.map((item: MenuItem) => (
                        <li
                          key={item._id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.35rem 0',
                            borderBottom: '1px solid var(--color-border)',
                          }}
                        >
                          <span style={{ fontSize: '0.9375rem' }}>{item.name}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              aria-label="Decrease"
                              onClick={() =>
                                handleQty(
                                  dateStr,
                                  meal.id,
                                  item._id,
                                  Math.max(0, (quantities[qtyKey(dateStr, meal.id, item._id)] ?? 0) - 1)
                                )
                              }
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min={0}
                              step="0.1"
                              inputMode="decimal"
                              aria-label="Quantity"
                              value={draftQty[qtyKey(dateStr, meal.id, item._id)] ?? quantities[qtyKey(dateStr, meal.id, item._id)] ?? 0}
                              onChange={(e) => setDraftQty((prev) => ({ ...prev, [qtyKey(dateStr, meal.id, item._id)]: e.target.value }))}
                              onBlur={() => commitDraft(qtyKey(dateStr, meal.id, item._id))}
                              className="input input-qty"
                              style={{ width: 56, minWidth: 56, textAlign: 'center' }}
                            />
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              aria-label="Increase"
                              onClick={() =>
                                handleQty(dateStr, meal.id, item._id, (quantities[qtyKey(dateStr, meal.id, item._id)] ?? 0) + 1)
                              }
                            >
                              +
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  {unselectedItems.length > 0 && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <label className="input-label" style={{ display: 'block', marginBottom: '0.25rem' }}>Add item</label>
                      <select
                        className="input"
                        style={{ width: '100%', maxWidth: 320, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}
                        value=""
                        onChange={(e) => {
                          const id = e.target.value
                          if (id) {
                            handleQty(dateStr, meal.id, id, 1)
                            e.target.value = ''
                          }
                        }}
                      >
                        <option value="">Choose an item to add…</option>
                        {unselectedItems.map((item: MenuItem) => (
                          <option key={item._id} value={item._id}>{item.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )
            })}
            </div>
          </div>
        ))}
      </div>
      <Button onClick={handleSaveWeek} disabled={saving} style={{ marginTop: '1rem' }}>
        {saving ? 'Saving…' : 'Save my week'}
      </Button>
    </Card>
  )
}
