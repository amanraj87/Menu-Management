import { Outlet } from 'react-router-dom'
import { Layout, Header } from '@/shared/ui'
import { Link } from 'react-router-dom'
import { LiveUpdateBanner } from '@/features/vendor/LiveUpdateBanner'

const vendorNav = [
  { to: '/vendor', label: "Today's orders" },
  { to: '/vendor/tomorrow', label: 'Tomorrow' },
  { to: '/vendor/menu', label: 'Update menu' },
]

export function VendorLayout() {
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
