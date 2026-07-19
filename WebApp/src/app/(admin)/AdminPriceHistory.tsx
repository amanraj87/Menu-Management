import { useMemo, useState } from 'react'
import { Card, Loader } from '@/shared/ui'
import { usePriceHistory } from '@/shared/graphql/hooks'
import { useMenuItems } from '@/shared/graphql/hooks'

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function formatPrice(v: number | null): string {
  if (v == null) return '—'
  return `₹${v}`
}

export function AdminPriceHistory() {
  const { history, isLoading } = usePriceHistory()
  const { items: menuItems, isLoading: menuLoading } = useMenuItems()
  const [filter, setFilter] = useState('')

  const menuItemNames = useMemo(() => {
    const names = new Set<string>()
    for (const h of history) names.add(h.menuItemName)
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [history])

  const filtered = useMemo(() => {
    if (!filter) return history
    return history.filter(h => h.menuItemName === filter)
  }, [history, filter])

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>()
    for (const entry of filtered) {
      const date = formatDate(entry.changedAt)
      const list = map.get(date) ?? []
      list.push(entry)
      map.set(date, list)
    }
    return Array.from(map.entries())
  }, [filtered])

  if (isLoading || menuLoading) return <Loader />

  return (
    <Card className="content-card" title="Price History">
      <p className="content-subtitle">Track when vendors changed menu item prices.</p>

      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          className="input"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{ minWidth: 200, fontSize: '0.875rem' }}
        >
          <option value="">All items</option>
          {menuItemNames.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
          {filtered.length} change{filtered.length !== 1 ? 's' : ''} recorded
        </span>
      </div>

      {filtered.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem 1rem',
          color: 'var(--color-text-muted)',
        }}>
          <p style={{ fontSize: '2rem', margin: '0 0 0.5rem' }}>📊</p>
          <p style={{ margin: 0, fontWeight: 600 }}>No price changes yet</p>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem' }}>
            Price changes will appear here when a vendor updates a menu item&apos;s price.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {grouped.map(([date, entries]) => (
            <div key={date}>
              <h4 style={{
                margin: '0 0 0.5rem',
                fontSize: '0.8125rem',
                fontWeight: 700,
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                {date}
              </h4>
              <div style={{
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                overflow: 'hidden',
                background: 'var(--color-surface)',
              }}>
                {entries.map((entry, i) => (
                  <div
                    key={entry.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.65rem 1rem',
                      borderTop: i > 0 ? '1px solid var(--color-border)' : undefined,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                        {entry.menuItemName}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.1rem' }}>
                        {formatTime(entry.changedAt)}
                      </div>
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      flexShrink: 0,
                    }}>
                      <span style={{
                        color: entry.oldPrice != null ? 'var(--color-text-muted)' : 'var(--color-text-faint)',
                        textDecoration: entry.oldPrice != null ? 'line-through' : undefined,
                        fontSize: '0.85rem',
                      }}>
                        {formatPrice(entry.oldPrice)}
                      </span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                      <span style={{
                        color: 'var(--color-primary)',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                      }}>
                        {formatPrice(entry.newPrice)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
