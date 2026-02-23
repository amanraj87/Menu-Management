import { useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Layout, Sidebar, Header } from '@/shared/ui'
import { useUIStore } from '@/shared/stores/uiStore'

const adminNav = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/users', label: 'Users & vendors' },
  { to: '/admin/orders', label: 'Combined orders' },
  { to: '/admin/feedback', label: 'Feedback & suggestions' },
  { to: '/admin/menu', label: 'View menu' },
]

export function AdminLayout() {
  const { sidebarOpen, toggleSidebar, userSession } = useUIStore()
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
      <Sidebar
        open={sidebarOpen}
        onClose={() => useUIStore.getState().setSidebarOpen(false)}
        header={<span>Admin</span>}
        items={adminNav}
      />
      <div className="layout-main">
        <Header
          title="Admin Portal"
          actions={
            <nav className="vendor-nav">
              <button type="button" className="vendor-nav-btn md:hidden" onClick={toggleSidebar}>
                Menu
              </button>
              <button type="button" className="vendor-nav-btn" onClick={signOut}>Sign out</button>
            </nav>
          }
        />
        <main style={{ padding: '1.25rem', flex: 1 }}>
          <Outlet />
        </main>
      </div>
    </Layout>
  )
}
