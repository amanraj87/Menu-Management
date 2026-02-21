import { Outlet, useNavigate } from 'react-router-dom'
import { Layout, Sidebar, Header } from '@/shared/ui'
import { useUIStore } from '@/shared/stores/uiStore'
import { Button } from '@/shared/ui'
import { Link } from 'react-router-dom'

const adminNav = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/week', label: 'My week' },
  { to: '/admin/users', label: 'Users & vendors' },
  { to: '/admin/orders', label: 'Combined orders' },
  { to: '/admin/feedback', label: 'Feedback & suggestions' },
  { to: '/admin/menu', label: 'View menu' },
]

export function AdminLayout() {
  const { sidebarOpen, toggleSidebar, userSession } = useUIStore()
  const setUserSession = useUIStore((s) => s.setUserSession)
  const navigate = useNavigate()
  if (!userSession?.userId) {
    navigate('/', { replace: true })
    return null
  }
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
            <>
              <Button variant="ghost" size="sm" onClick={toggleSidebar} className="md:hidden">
                Menu
              </Button>
              <Link to="/person"><Button variant="outline" size="sm">My meals</Button></Link>
              <Link to="/vendor"><Button variant="outline" size="sm">Vendor</Button></Link>
              <Button variant="ghost" size="sm" onClick={signOut}>Sign out</Button>
            </>
          }
        />
        <main style={{ padding: '1.25rem', flex: 1 }}>
          <Outlet />
        </main>
      </div>
    </Layout>
  )
}
