import { Outlet } from 'react-router-dom'
import { Layout, Sidebar, Header } from '@/shared/ui'
import { useUIStore } from '@/shared/stores/uiStore'
import { Button } from '@/shared/ui'

const personNav = [
  { to: '/person', label: 'My choices' },
]

export function PersonLayout() {
  const { sidebarOpen, toggleSidebar } = useUIStore()
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
