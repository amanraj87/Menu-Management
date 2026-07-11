import { useState, useEffect } from 'react'
import { Card, Loader, Modal } from '@/shared/ui'
import type { MealType, MenuItem } from '@/shared/types'
import { useMenuItems, useMySelectionsForWeek, useMyMealDoneForWeek, useMarkMealDone, useMealDoneStatus, useConfirmedOrders, useMealCancellationsForRange } from '@/shared/graphql/hooks'
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

export function PersonTodayView() {
  const today = toDateString(new Date())
  const startDate = getWeekStart(today)
  const toast = useToastStore()

  const { items: allMenuItems, isLoading: menuLoading } = useMenuItems()
  const { selections, isLoading: weekLoading } = useMySelectionsForWeek(startDate)
  const { doneList, isLoading: doneLoading } = useMyMealDoneForWeek(startDate)
  const { mutate: markDoneMutate } = useMarkMealDone()
  const { orders: confirmedToday } = useConfirmedOrders(today)
  const { cancellations } = useMealCancellationsForRange(today, today)
  const isMealCancelled = (meal: MealType) => cancellations.some((c) => c.date === today && c.mealType === meal)
  const doneStatus = {
    breakfast: useMealDoneStatus(today, 'breakfast'),
    lunch: useMealDoneStatus(today, 'lunch'),
    dinner: useMealDoneStatus(today, 'dinner'),
  }

  const [localDone, setLocalDone] = useState<Set<string>>(new Set())
  const [attendanceMeal, setAttendanceMeal] = useState<MealType | null>(null)

  /** Everyone who ordered a given meal today (from the confirmed order breakdown). */
  const rosterFor = (meal: MealType): Array<{ userId: string; userName: string }> => {
    const map = new Map<string, string>()
    for (const o of confirmedToday) {
      if (o.mealType !== meal) continue
      for (const it of o.items) {
        for (const p of it.personBreakdown) map.set(p.userId, p.userName)
      }
    }
    // Include anyone who marked eaten even if not in the breakdown.
    for (const u of doneStatus[meal].doneUsers) map.set(u.userId, u.userName)
    return Array.from(map, ([userId, userName]) => ({ userId, userName }))
  }

  /** menuItem dishes each person ordered for a given meal today. */
  const dishesByUserFor = (meal: MealType): Map<string, Array<{ name: string; quantity: number }>> => {
    const map = new Map<string, Array<{ name: string; quantity: number }>>()
    for (const o of confirmedToday) {
      if (o.mealType !== meal) continue
      for (const it of o.items) {
        for (const p of it.personBreakdown) {
          if (!map.has(p.userId)) map.set(p.userId, [])
          map.get(p.userId)!.push({ name: it.name, quantity: p.quantity })
        }
      }
    }
    return map
  }

  const attendance = (meal: MealType) => {
    const eatenIds = new Set(doneStatus[meal].doneUsers.map((u) => u.userId))
    const roster = rosterFor(meal)
    const eaten = roster.filter((p) => eatenIds.has(p.userId)).sort((a, b) => a.userName.localeCompare(b.userName))
    const notEaten = roster.filter((p) => !eatenIds.has(p.userId)).sort((a, b) => a.userName.localeCompare(b.userName))
    return { eaten, notEaten, total: roster.length }
  }

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
          const cancelled = isMealCancelled(mealType)
          const att = attendance(mealType)
          return (
            <section key={mealType} style={{ flex: 1, minWidth: 160 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 0.5rem' }}>
                <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--color-text-muted)', textDecoration: cancelled ? 'line-through' : 'none' }}>
                  {mealLabel}
                </h4>
                {!cancelled && (
                  <span
                    onClick={() => handleMarkDone(mealType)}
                    style={{ cursor: 'pointer', fontSize: '1.4rem', userSelect: 'none' }}
                    title={isMealDone(mealType) ? 'Eaten' : 'Mark as eaten'}
                  >
                    {isMealDone(mealType) ? '😋' : '🍔'}
                  </span>
                )}
              </div>
              {cancelled ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '1.5rem 0.5rem', minHeight: 120 }}>
                  <span style={{ fontSize: '3.5rem', lineHeight: 1 }}>👨‍🍳</span>
                  <span style={{ color: 'var(--color-danger, #ef4444)', fontSize: '0.85rem', fontWeight: 700, textAlign: 'center' }}>Cancelled — kitchen closed</span>
                </div>
              ) : (
                <>
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
                  <button
                    type="button"
                    onClick={() => setAttendanceMeal(mealType)}
                    title="See who's eaten"
                    style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.6rem', width: '100%', padding: '0.4rem 0.6rem', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-surface)', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    <span style={{ fontWeight: 700 }}>😋 {att.eaten.length}</span>
                    <span style={{ color: 'var(--color-text-muted)' }}>·</span>
                    <span style={{ fontWeight: 700 }}>🤤 {att.notEaten.length}</span>
                    <span style={{ marginLeft: 'auto', color: 'var(--color-text-muted)' }}>›</span>
                  </button>
                </>
              )}
            </section>
          )
        })}
      </div>
      <p style={{ marginTop: '1.25rem', marginBottom: 0, fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
        To change your choices, go to <Link to="/person/week">My week</Link>.
      </p>
    </Card>
    {attendanceMeal && (() => {
      const att = attendance(attendanceMeal)
      const dishes = dishesByUserFor(attendanceMeal)
      const label = MEALS.find((m) => m.id === attendanceMeal)?.label ?? ''
      const renderList = (people: Array<{ userId: string; userName: string }>, emoji: string) =>
        people.length === 0 ? null : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {people.map((p) => {
              const ds = dishes.get(p.userId) ?? []
              return (
                <li key={p.userId} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.45rem 0.55rem', borderRadius: 8, background: 'var(--color-bg)' }}>
                  <span>{emoji}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 500 }}>{p.userName}</div>
                    {ds.length > 0 && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {ds.map((d) => `${d.name}${d.quantity !== 1 ? ` ×${d.quantity}` : ''}`).join(', ')}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )
      return (
        <Modal open onClose={() => setAttendanceMeal(null)} title={`${label} — who's eaten?`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '60vh', overflowY: 'auto' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem', padding: '0.5rem 0.85rem', borderRadius: 10, background: 'rgba(34,197,94,0.16)', color: 'var(--color-primary, #22c55e)', fontWeight: 800, fontSize: '1rem', boxShadow: '0 0 0 1px rgba(34,197,94,0.35), 0 2px 10px rgba(34,197,94,0.25)' }}>
                <span>😋 Eaten</span>
                <span>{att.eaten.length}</span>
              </div>
              {att.eaten.length === 0
                ? <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>No one has eaten yet.</p>
                : renderList(att.eaten, '😋')}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem', padding: '0.5rem 0.85rem', borderRadius: 10, background: 'rgba(245,158,11,0.16)', color: 'var(--color-warning, #f59e0b)', fontWeight: 800, fontSize: '1rem', boxShadow: '0 0 0 1px rgba(245,158,11,0.35), 0 2px 10px rgba(245,158,11,0.25)' }}>
                <span>🤤 Not yet</span>
                <span>{att.notEaten.length}</span>
              </div>
              {att.notEaten.length === 0
                ? <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Everyone has eaten! 🎉</p>
                : renderList(att.notEaten, '🤤')}
            </div>
            {att.total === 0 && (
              <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.875rem', fontStyle: 'italic' }}>
                No orders for this meal today.
              </p>
            )}
          </div>
        </Modal>
      )
    })()}
    </>
  )
}
