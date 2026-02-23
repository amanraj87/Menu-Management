import { Card, Loader } from '@/shared/ui'
import type { MealType, MenuItem } from '@/shared/types'
import { useMenuItems, useMySelectionsForWeek } from '@/shared/graphql/hooks'
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

  const { items: allMenuItems, isLoading: menuLoading } = useMenuItems()
  const { selections, isLoading: weekLoading } = useMySelectionsForWeek(startDate)

  const todaySelections = selections.filter((s) => s.date === today)
  const menuMap = new Map<string, MenuItem>(allMenuItems.map((m) => [m._id, m]))

  const isLoading = menuLoading || weekLoading

  if (isLoading) {
    return <Loader />
  }

  return (
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
          if (resolved.length === 0) {
            return (
              <section key={mealType} style={{ flex: 1, minWidth: 160 }}>
                <h4 style={{ margin: '0 0 0.5rem', fontSize: '1rem', color: 'var(--color-text-muted)' }}>
                  {mealLabel}
                </h4>
                <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                  No items selected.
                </p>
              </section>
            )
          }
          return (
            <section key={mealType} style={{ flex: 1, minWidth: 160 }}>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '1rem', color: 'var(--color-text-muted)' }}>
                {mealLabel}
              </h4>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', listStyle: 'disc' }}>
                {resolved.map((item, idx) => (
                  <li key={idx} style={{ marginBottom: '0.25rem' }}>
                    {item.name} — {item.quantity} {item.unit}{item.quantity !== 1 ? 's' : ''}
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
      <p style={{ marginTop: '1.25rem', marginBottom: 0, fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
        To change your choices, go to <Link to="/person/week">My week</Link>.
      </p>
    </Card>
  )
}
