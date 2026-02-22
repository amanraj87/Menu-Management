import { useState, useEffect, useRef } from 'react'
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

const MealIcon = ({ mealId }: { mealId: MealType }) => {
  const size = 18
  const style = { width: size, height: size, color: 'var(--color-text-muted)', flexShrink: 0 }
  if (mealId === 'breakfast') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden>
        <path d="M2 17h20" />
        <path d="M7 17a5 5 0 0 0 10 0" />
        <path d="M12 7v2M9 10l1.5 1.5M15 10l-1.5 1.5" />
      </svg>
    )
  }
  if (mealId === 'lunch') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden>
        <circle cx="12" cy="12" r="5" />
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

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
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set())
  const [openAddItemKey, setOpenAddItemKey] = useState<string | null>(null)
  const [addItemSearch, setAddItemSearch] = useState<Record<string, string>>({})
  const [addItemAnchor, setAddItemAnchor] = useState<DOMRect | null>(null)
  const addItemPopoverRef = useRef<HTMLDivElement>(null)

  const closeAddItemPopover = () => {
    setOpenAddItemKey(null)
    setAddItemAnchor(null)
  }

  useEffect(() => {
    if (openAddItemKey == null) return
    const onMouseDown = (e: MouseEvent) => {
      if (addItemPopoverRef.current?.contains(e.target as Node)) return
      closeAddItemPopover()
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [openAddItemKey])

  const toggleDay = (dateStr: string) => {
    setCollapsedDays((prev) => {
      const next = new Set(prev)
      if (next.has(dateStr)) next.delete(dateStr)
      else next.add(dateStr)
      return next
    })
  }

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
    <Card className="person-week-card" title="My week — choose meals for each day">
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
        {weekDates.map((dateStr, dayIndex) => {
          const isCollapsed = collapsedDays.has(dateStr)
          return (
          <div
            key={dateStr}
            style={{
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              overflow: 'hidden',
              background: 'var(--color-surface)',
            }}
          >
            <button
              type="button"
              onClick={() => toggleDay(dateStr)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem',
                padding: '1rem',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                font: 'inherit',
                color: 'inherit',
              }}
              aria-expanded={!isCollapsed}
            >
              <h3 style={{ margin: 0, fontSize: '1rem' }}>
                {DAY_NAMES[dayIndex]} — {dateStr}
              </h3>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  flexShrink: 0,
                  transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                }}
                aria-hidden
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {!isCollapsed && (
            <div style={{ padding: '1rem 1rem 1rem' }}>
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
                <Card key={meal.id} className="person-week-meal-card" style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <div className="person-week-meal-card-header">
                    <MealIcon mealId={meal.id} />
                    <span>{meal.label}</span>
                  </div>
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
                            padding: '0.25rem 0',
                            borderBottom: '1px solid var(--color-border)',
                          }}
                        >
                          <span className="person-week-meal-item-name">{item.name}</span>
                          <div className="person-week-qty-controls" style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            <button
                              type="button"
                              className="btn btn-ghost"
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
                              className="input input-qty person-week-qty-input"
                              style={{ width: 44, minWidth: 44, textAlign: 'center' }}
                            />
                            <button
                              type="button"
                              className="btn btn-ghost"
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
                    <div style={{ marginTop: '0.35rem', display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="person-week-add-item-btn"
                        onClick={(e) => {
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                          setAddItemAnchor(rect)
                          setOpenAddItemKey(`${dateStr}-${meal.id}`)
                        }}
                      >
                        <span>Add an item…</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </button>
                    </div>
                  )}
                </Card>
              )
            })}
            </div>
            </div>
            )}
          </div>
          )
        })}
      </div>
      <Button onClick={handleSaveWeek} disabled={saving} style={{ marginTop: '1rem' }}>
        {saving ? 'Saving…' : 'Save my week'}
      </Button>
      {openAddItemKey != null && addItemAnchor != null && (() => {
        const dateStr = openAddItemKey.slice(0, 10)
        const mealId = openAddItemKey.slice(11) as MealType
        const allMealItems = menuByMeal[mealId] ?? []
        const unselectedItems = allMealItems.filter(
          (item: MenuItem) => (quantities[qtyKey(dateStr, mealId, item._id)] ?? 0) === 0
        )
        const search = addItemSearch[openAddItemKey] ?? ''
        const filtered = [...unselectedItems]
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
          .filter((item) =>
            search.trim() === '' ? true : item.name.toLowerCase().includes(search.toLowerCase())
          )
        return (
          <div
            ref={addItemPopoverRef}
            style={{
              position: 'fixed',
              top: addItemAnchor.bottom + 6,
              left: addItemAnchor.left,
              minWidth: addItemAnchor.width,
              maxWidth: 320,
              zIndex: 1000,
              padding: '0.5rem',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              background: 'var(--color-surface)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
          >
            <input
              type="text"
              className="input"
              placeholder="Search items…"
              value={search}
              onChange={(e) => setAddItemSearch((prev) => ({ ...prev, [openAddItemKey]: e.target.value }))}
              style={{ width: '100%', fontSize: '0.875rem', marginBottom: '0.5rem' }}
              autoFocus
            />
            <ul
              className="person-week-add-item-popup-list"
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                maxHeight: 200,
                overflowY: 'auto',
              }}
            >
              {filtered.map((item: MenuItem) => (
                <li key={item._id}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{
                      width: '100%',
                      justifyContent: 'flex-start',
                      textAlign: 'left',
                      fontSize: '0.875rem',
                      padding: '0.5rem 0.75rem',
                    }}
                    onClick={() => {
                      handleQty(dateStr, mealId, item._id, 1)
                      closeAddItemPopover()
                      setAddItemSearch((prev) => {
                        const next = { ...prev }
                        delete next[openAddItemKey]
                        return next
                      })
                    }}
                  >
                    {item.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )
      })()}
    </Card>
  )
}
