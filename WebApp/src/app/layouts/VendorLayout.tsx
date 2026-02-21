import { Outlet, useNavigate, NavLink, Link } from 'react-router-dom'
import { Layout, Header } from '@/shared/ui'
import { useUIStore } from '@/shared/stores/uiStore'
import { LiveUpdateBanner } from '@/features/vendor/LiveUpdateBanner'

const vendorNav = [
  { to: '/vendor', label: "Today's orders", end: true },
  { to: '/vendor/week', label: 'Week', end: false },
  { to: '/vendor/feedback', label: 'Feedback', end: false },
  { to: '/vendor/menu', label: 'Update menu', end: false },
]

export function VendorLayout() {
  const userSession = useUIStore((s) => s.userSession)
  const navigate = useNavigate()
  if (!userSession?.userId) {
    navigate('/', { replace: true })
    return null
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
            <Link to="/admin" className="vendor-nav-btn vendor-nav-btn-admin">
              Admin
            </Link>
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
