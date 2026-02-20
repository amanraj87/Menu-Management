import { Card, Button, Badge } from '@/shared/ui'
import { Link } from 'react-router-dom'

const weekLabel = 'Feb 20 - Feb 26'
const mealsToday = [
  { name: 'Breakfast', status: 'ok' as const },
  { name: 'Lunch', status: 'updated' as const },
  { name: 'Dinner', status: 'ok' as const },
]

export function AdminDashboard() {
  return (
    <>
      <Card title={`Week: ${weekLabel}`}>
        <div style={{ marginBottom: '1rem' }}>
          <strong>Meals Today</strong>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0' }}>
            {mealsToday.map((m) => (
              <li key={m.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <span>{m.name}</span>
                {m.status === 'ok' && <Badge variant="success">✅</Badge>}
                {m.status === 'updated' && <Badge variant="warning">⚠ Updated</Badge>}
              </li>
            ))}
          </ul>
        </div>
        <p style={{ margin: '0 0 1rem', color: 'var(--color-text-muted)' }}>People Count: 9</p>
        <p style={{ margin: '0 0 1rem', color: 'var(--color-text-muted)' }}>Pending Changes: 2</p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link to="/admin/orders"><Button>Combined orders & confirm</Button></Link>
        </div>
      </Card>
    </>
  )
}
