import { useEffect } from 'react'
import { Outlet, useNavigate, NavLink } from 'react-router-dom'
import { Layout, Header } from '@/shared/ui'
import { useUIStore } from '@/shared/stores/uiStore'

const adminNav = [
  { to: '/admin/week', label: 'Week' },
  { to: '/admin/users', label: 'Users & vendors' },
  { to: '/admin/feedback', label: 'Feedback & suggestions' },
  { to: '/admin/menu', label: 'View menu' },
  { to: '/admin/price-history', label: 'Price history' },
]

export function AdminLayout() {
  const userSession = useUIStore((s) => s.userSession)
  const setUserSession = useUIStore((s) => s.setUserSession)
  const navigate = useNavigate()
  const isUnauthorized = !userSession?.userId || userSession.role !== 'admin'

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
