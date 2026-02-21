import { Outlet } from 'react-router-dom'
import { Layout } from '@/shared/ui'

export function AuthLayout() {
  return (
    <Layout className="layout-auth">
      <div className="auth-container">
        <Outlet />
      </div>
    </Layout>
  )
}
