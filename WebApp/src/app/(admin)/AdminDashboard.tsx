import { Card, Button, Badge, Loader } from '@/shared/ui'
import { Link } from 'react-router-dom'
import { useUsers, useFeedbacksForAdmin, useConfirmedOrders } from '@/shared/graphql/hooks'

function toDateString(d: Date) {
  return d.toISOString().slice(0, 10)
}

export function AdminDashboard() {
  const today = toDateString(new Date())
  const { users, isLoading: usersLoading } = useUsers()
  const { feedbacks, isLoading: feedbackLoading } = useFeedbacksForAdmin()
  const { orders: todayOrders, isLoading: ordersLoading } = useConfirmedOrders(today)

  const pendingFeedback = feedbacks.filter((f) => f.status === 'pending').length
  const isLoading = usersLoading || feedbackLoading || ordersLoading

  if (isLoading) return <Loader />

  const personCount = users.filter((u) => u.role === 'person').length
  const vendorCount = users.filter((u) => u.role === 'vendor').length
  const todayMealsCount = todayOrders.length

  return (
    <>
      <Card title="Dashboard">
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>
          Overview and quick links for admin tasks.
        </p>

        <section style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '0.9375rem', marginBottom: '0.5rem', fontWeight: 600 }}>Today</h3>
          <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            {today} · {todayMealsCount} meal order{todayMealsCount !== 1 ? 's' : ''} confirmed for today
          </p>
          <Link to="/admin/orders" style={{ display: 'inline-block', marginTop: '0.5rem' }}>
            <Button size="sm">Combined orders</Button>
          </Link>
        </section>

        <section style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '0.9375rem', marginBottom: '0.5rem', fontWeight: 600 }}>Summary</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
            <li style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
              <strong style={{ color: 'var(--color-text)' }}>{users.length}</strong> users
              {personCount > 0 && <span> ({personCount} person{personCount !== 1 ? 's' : ''}, {vendorCount} vendor{vendorCount !== 1 ? 's' : ''})</span>}
            </li>
            <li style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <strong style={{ color: 'var(--color-text)' }}>{pendingFeedback}</strong> pending feedback
              {pendingFeedback > 0 && (
                <Link to="/admin/feedback">
                  <Badge variant="warning">Review</Badge>
                </Link>
              )}
            </li>
          </ul>
        </section>

        <section>
          <h3 style={{ fontSize: '0.9375rem', marginBottom: '0.5rem', fontWeight: 600 }}>Quick links</h3>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Link to="/admin/orders"><Button variant="outline" size="sm">Combined orders</Button></Link>
            <Link to="/admin/feedback"><Button variant="outline" size="sm">Feedback & suggestions</Button></Link>
            <Link to="/admin/users"><Button variant="outline" size="sm">Users & vendors</Button></Link>
            <Link to="/admin/menu"><Button variant="outline" size="sm">View menu</Button></Link>
          </div>
        </section>
      </Card>
    </>
  )
}
