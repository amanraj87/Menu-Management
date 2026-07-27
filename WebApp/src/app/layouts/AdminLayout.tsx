import { useEffect, useState } from 'react'
import { Outlet, useNavigate, NavLink } from 'react-router-dom'
import { useApolloClient } from '@apollo/client/react'
import { Layout, Header } from '@/shared/ui'
import type { MealType } from '@/shared/types'
import { useUIStore } from '@/shared/stores/uiStore'
import { useToastStore } from '@/shared/stores/toastStore'
import { REMIND_NOT_EATEN } from '@/shared/graphql/operations'

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const REMIND_MEALS: { id: MealType; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
]

const adminNav = [
  { to: '/admin/week', label: 'Week' },
  { to: '/admin/users', label: 'Users & vendors' },
  { to: '/admin/feedback', label: 'Feedback & suggestions' },
  { to: '/admin/menu', label: 'Menu' },
  { to: '/admin/price-history', label: 'Price history' },
]

export function AdminLayout() {
  const userSession = useUIStore((s) => s.userSession)
  const setUserSession = useUIStore((s) => s.setUserSession)
  const navigate = useNavigate()
  const client = useApolloClient()
  const toast = useToastStore()
  const [reminding, setReminding] = useState(false)
  const [remindMenuOpen, setRemindMenuOpen] = useState(false)
  const isUnauthorized = !userSession?.userId || userSession.role !== 'admin'

  const remindMeal = async (mealType: MealType) => {
    setRemindMenuOpen(false)
    setReminding(true)
    try {
      const res = await client.mutate<{ remindNotEaten: number }>({
        mutation: REMIND_NOT_EATEN,
        variables: { date: todayStr(), mealType },
      })
      const n = res.data?.remindNotEaten ?? 0
      const label = mealType.charAt(0).toUpperCase() + mealType.slice(1)
      toast.add(
        n > 0 ? `${label} reminder sent to ${n} ${n === 1 ? 'person' : 'people'}.` : `Nobody to remind — everyone logged ${label.toLowerCase()}.`,
        n > 0 ? 'success' : 'info',
      )
    } catch (e) {
      toast.add((e as Error).message, 'error')
    } finally {
      setReminding(false)
    }
  }

  useEffect(() => {
    if (isUnauthorized) {
      setUserSession(null)
      navigate('/', { replace: true })
    }
  }, [isUnauthorized, setUserSession, navigate])

  if (isUnauthorized) return null

  const signOut = () => { setUserSession(null); navigate('/', { replace: true }) }
  return (
    <Layout>
      <Header
        title="Admin Portal"
        actions={
          <nav className="vendor-nav">
            {adminNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `vendor-nav-btn ${isActive ? 'vendor-nav-btn-active' : ''}`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="vendor-nav-btn"
                onClick={() => setRemindMenuOpen((o) => !o)}
                disabled={reminding}
                title="Remind users who haven't eaten a meal to update their status"
                aria-label="Remind users to update their eaten status"
                aria-haspopup="menu"
                aria-expanded={remindMenuOpen}
              >
                🔔
              </button>
              {remindMenuOpen && (
                <>
                  <div
                    onClick={() => setRemindMenuOpen(false)}
                    style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                  />
                  <div className="remind-menu" role="menu">
                    <div className="remind-menu__label">Remind who hasn&apos;t eaten…</div>
                    {REMIND_MEALS.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        role="menuitem"
                        className="remind-menu__item"
                        onClick={() => remindMeal(m.id)}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button type="button" className="vendor-nav-btn" onClick={signOut}>
              Sign out
            </button>
          </nav>
        }
      />
      <main style={{ padding: '1.25rem', flex: 1 }}>
        <Outlet />
      </main>
    </Layout>
  )
}
