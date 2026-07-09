import { useEffect } from 'react'
import { Outlet, useNavigate, NavLink } from 'react-router-dom'
import { Layout, Header } from '@/shared/ui'
import { useUIStore } from '@/shared/stores/uiStore'
import { LiveUpdateBanner } from '@/features/vendor/LiveUpdateBanner'

const vendorNav = [
  { to: '/vendor/week', label: 'Week', end: false },
  { to: '/vendor/feedback', label: 'Feedback', end: false },
  { to: '/vendor/menu', label: 'Update menu', end: false },
]

export function VendorLayout() {
  const userSession = useUIStore((s) => s.userSession)
  const setUserSession = useUIStore((s) => s.setUserSession)
  const navigate = useNavigate()
  const isUnauthorized = !userSession?.userId || userSession.role !== 'vendor'

  useEffect(() => {
    if (isUnauthorized) {
      setUserSession(null)
      navigate('/', { replace: true })
    }
  }, [isUnauthorized, setUserSession, navigate])

  if (isUnauthorized) return null

  const signOut = () => {
    setUserSession(null)
    navigate('/', { replace: true })
  }
  return (
    <Layout>
      <Header
        title="Vendor Portal"
        actions={
          <nav className="vendor-nav">
            {vendorNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
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
      <LiveUpdateBanner />
      <main style={{ padding: '1rem', flex: 1 }}>
        <Outlet />
      </main>
    </Layout>
  )
}
