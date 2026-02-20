import { Card } from '@/shared/ui'

const historyItems = [
  { version: 6, change: 'Removed Egg' },
  { version: 5, change: 'Updated Pulka qty' },
  { version: 4, change: 'Added Dal Fry' },
]

export function ChangeHistory() {
  return (
    <>
      <Card title="Change History">
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }}>Menu version history.</p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {historyItems.map((item) => (
            <li key={item.version} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)' }}>
              <strong>Version {item.version}</strong> → {item.change}
            </li>
          ))}
        </ul>
      </Card>
    </>
  )
}
