import { Outlet } from 'react-router-dom'
import { Layout } from '@/shared/ui'

export function AuthLayout() {
  return (
    <Layout className="layout-auth">
      <div style={{ maxWidth: 400, margin: '2rem auto', padding: '0 1rem' }}>
        <Outlet />
      </div>
    </Layout>
  )
}
