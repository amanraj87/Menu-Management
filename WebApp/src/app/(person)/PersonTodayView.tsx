import { useState, useEffect } from 'react'
import { Card, Loader } from '@/shared/ui'
import type { MealType, MenuItem } from '@/shared/types'
import { useMenuItems, useMySelectionsForWeek, useMyMealDoneForWeek, useMarkMealDone, useMealDoneStatus } from '@/shared/graphql/hooks'
import { useToastStore } from '@/shared/stores/toastStore'
import { Link } from 'react-router-dom'

const MEALS: { id: MealType; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
]

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

function formatDisplayDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

/** Saturday (6) or Sunday (0) — time to plan the upcoming week. */
function isWeekend(dateStr: string): boolean {
  const day = new Date(dateStr + 'T12:00:00').getDay()
  return day === 0 || day === 6
}

export function PersonTodayView() {
  const today = toDateString(new Date())
  const startDate = getWeekStart(today)
  const toast = useToastStore()

  const { items: allMenuItems, isLoading: menuLoading } = useMenuItems()
  const { selections, isLoading: weekLoading } = useMySelectionsForWeek(startDate)
  const { doneList, isLoading: doneLoading } = useMyMealDoneForWeek(startDate)
  const { mutate: markDoneMutate } = useMarkMealDone()
  const doneStatus = {
    breakfast: useMealDoneStatus(today, 'breakfast'),
    lunch: useMealDoneStatus(today, 'lunch'),
    dinner: useMealDoneStatus(today, 'dinner'),
  }

  const [localDone, setLocalDone] = useState<Set<string>>(new Set())

  useEffect(() => {
    const next = new Set<string>()
    doneList.forEach((d) => next.add(`${d.date}|${d.mealType}`))
    setLocalDone(next)
  }, [doneList])

  const isMealDone = (meal: MealType) => localDone.has(`${today}|${meal}`)

  const handleMarkDone = async (meal: MealType) => {
    const k = `${today}|${meal}`
    const currentlyDone = localDone.has(k)
    const newDone = !currentlyDone
    setLocalDone((prev) => {
      const next = new Set(prev)
      if (newDone) next.add(k)
      else next.delete(k)
      return next
    })
    try {
      await markDoneMutate({ variables: { date: today, mealType: meal, done: newDone } })
    } catch (e) {
      setLocalDone((prev) => {
        const next = new Set(prev)
        if (currentlyDone) next.add(k)
        else next.delete(k)
        return next
      })
      toast.add((e as Error).message, 'error')
    }
  }

  const todaySelections = selections.filter((s) => s.date === today)
  const menuMap = new Map<string, MenuItem>(allMenuItems.map((m) => [m._id, m]))

  const isLoading = menuLoading || weekLoading || doneLoading

  if (isLoading) {
    return <Loader />
  }

  return (
    <>
      {isWeekend(today) && (
        <Card className="content-card" style={{ marginBottom: '1rem', borderColor: 'var(--color-warning, #f59e0b)', background: 'rgba(245,158,11,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.4rem' }}>🗓️</span>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontWeight: 700, marginBottom: '0.15rem' }}>It's the weekend — plan next week!</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                Head to <Link to="/person/week">My week</Link> and use “Import from last week” to set your meals for the coming week.
              </div>
            </div>
          </div>
        </Card>
      )}
    <Card className="content-card" title="Today's meals">
      <p className="content-subtitle" style={{ marginBottom: '1.25rem' }}>
        {formatDisplayDate(today)}
      </p>
      <div style={{ display: 'flex', flexDirection: 'row', gap: '1.5rem', flexWrap: 'wrap' }}>
        {MEALS.map(({ id: mealType, label: mealLabel }) => {
          const sel = todaySelections.find((s) => s.mealType === mealType)
          const items = (sel?.items ?? []).filter((i) => i.quantity > 0)
          const resolved = items.map((i) => {
            const menuItem = menuMap.get(i.menuItemId)
            return {
              name: menuItem?.name ?? 'Unknown item',
              unit: menuItem?.unit ?? 'portion',
              quantity: i.quantity,
            }
          })
          return (
            <section key={mealType} style={{ flex: 1, minWidth: 160 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 0.5rem' }}>
                <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--color-text-muted)' }}>
                  {mealLabel}
                </h4>
                <span
                  onClick={() => handleMarkDone(mealType)}
                  style={{ cursor: 'pointer', fontSize: '1.4rem', userSelect: 'none' }}
                  title={isMealDone(mealType) ? 'Eaten' : 'Mark as eaten'}
                >
                  {isMealDone(mealType) ? '😋' : '🍔'}
                </span>
              </div>
              {resolved.length === 0 ? (
                <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                  No items selected.
                </p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: '1.25rem', listStyle: 'disc' }}>
                  {resolved.map((item, idx) => (
                    <li key={idx} style={{ marginBottom: '0.25rem' }}>
                      {item.name} — {item.quantity} {item.unit}{item.quantity !== 1 ? 's' : ''}
                    </li>
                  ))}
                </ul>
              )}
              {doneStatus[mealType].doneUsers.length > 0 && (
                <p style={{ margin: '0.5rem 0 0', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border)', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                  😋 Eaten by: {doneStatus[mealType].doneUsers.map((u) => u.userName).join(', ')}
                </p>
              )}
            </section>
          )
        })}
      </div>
      <p style={{ marginTop: '1.25rem', marginBottom: 0, fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
        To change your choices, go to <Link to="/person/week">My week</Link>.
      </p>
    </Card>
    </>
  )
}
