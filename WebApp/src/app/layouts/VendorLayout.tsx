import { Outlet, useNavigate } from 'react-router-dom'
import { Layout, Header } from '@/shared/ui'
import { Link } from 'react-router-dom'
import { useUIStore } from '@/shared/stores/uiStore'
import { LiveUpdateBanner } from '@/features/vendor/LiveUpdateBanner'

const vendorNav = [
  { to: '/vendor', label: "Today's orders" },
  { to: '/vendor/tomorrow', label: 'Tomorrow' },
  { to: '/vendor/feedback', label: 'Feedback' },
  { to: '/vendor/menu', label: 'Update menu' },
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
          <nav style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {vendorNav.map((item) => (
              <Link key={item.to} to={item.to} style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{item.label}</Link>
            ))}
            <Link to="/admin" style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginLeft: '0.5rem' }}>Admin</Link>
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
