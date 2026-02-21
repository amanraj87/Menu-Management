import { Outlet, useNavigate } from 'react-router-dom'
import { Layout, Sidebar, Header } from '@/shared/ui'
import { useUIStore } from '@/shared/stores/uiStore'
import { Button } from '@/shared/ui'

const personNav = [
  { to: '/person/week', label: 'My week' },
  { to: '/person/menu', label: 'View menu' },
  { to: '/person/feedback', label: 'Feedback and suggestion' },
]

export function PersonLayout() {
  const { sidebarOpen, toggleSidebar, userSession } = useUIStore()
  const navigate = useNavigate()
  if (!userSession?.userId) {
    navigate('/', { replace: true })
    return null
  }
  return (
    <Layout>
      <Sidebar
        open={sidebarOpen}
        onClose={() => useUIStore.getState().setSidebarOpen(false)}
        header={<span>My meals</span>}
        items={personNav}
      />
      <div className="layout-main">
        <Header
          title="My meals"
          actions={
            <Button variant="ghost" size="sm" onClick={toggleSidebar} className="md:hidden">
              Menu
            </Button>
          }
        />
        <main style={{ padding: '1.25rem', flex: 1 }}>
          <Outlet />
        </main>
      </div>
    </Layout>
  )
}
