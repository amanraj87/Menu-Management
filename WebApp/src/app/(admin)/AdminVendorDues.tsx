import { useMemo, useState } from 'react'
import { Table, Thead, Tbody, Tr, Th, Td, Loader, Badge } from '@/shared/ui'
import { useVendorDues } from '@/shared/graphql/hooks'
import type { VendorDueDay } from '@/shared/graphql/hooks'

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Monday of the week containing d. */
function mondayOf(d: Date): Date {
  const x = new Date(d)
  const day = x.getDay()
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day))
  return x
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

type Preset = { id: string; label: string; range: () => { start: string; end: string } }

const PRESETS: Preset[] = [
  {
    id: 'thisWeek',
    label: 'This week',
    range: () => {
      const mon = mondayOf(new Date())
      return { start: fmt(mon), end: fmt(addDays(mon, 6)) }
    },
  },
  {
    id: 'lastWeek',
    label: 'Last week',
    range: () => {
      const mon = addDays(mondayOf(new Date()), -7)
      return { start: fmt(mon), end: fmt(addDays(mon, 6)) }
    },
  },
  {
    id: 'thisMonth',
    label: 'This month',
    range: () => {
      const n = new Date()
      return { start: fmt(new Date(n.getFullYear(), n.getMonth(), 1)), end: fmt(new Date(n.getFullYear(), n.getMonth() + 1, 0)) }
    },
  },
  {
    id: 'lastMonth',
    label: 'Last month',
    range: () => {
      const n = new Date()
      return { start: fmt(new Date(n.getFullYear(), n.getMonth() - 1, 1)), end: fmt(new Date(n.getFullYear(), n.getMonth(), 0)) }
    },
  },
]

const money = (v: number) => `₹${Math.round(v).toLocaleString('en-IN')}`

function dayLabel(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

export function AdminVendorDues() {
  const initial = PRESETS[0].range()
  const [start, setStart] = useState(initial.start)
  const [end, setEnd] = useState(initial.end)
  const [showEmpty, setShowEmpty] = useState(false)

  const { dues, isLoading, error } = useVendorDues(start, end)

  const activePreset = useMemo(() => {
    return PRESETS.find((p) => {
      const r = p.range()
      return r.start === start && r.end === end
    })?.id
  }, [start, end])

  const applyPreset = (p: Preset) => {
    const r = p.range()
    setStart(r.start)
    setEnd(r.end)
  }

  const rows: VendorDueDay[] = useMemo(() => {
    if (!dues) return []
    return showEmpty ? dues.days : dues.days.filter((d) => d.owed > 0 || d.sentToVendor)
  }, [dues, showEmpty])

  const hiddenCount = (dues?.days.length ?? 0) - rows.length
  const invalidRange = end < start

  return (
    <div>
      <p className="content-subtitle" style={{ marginTop: 0 }}>
        What you owe the vendor, based on the orders actually sent to them. When the vendor sets their own
        final amount for a day, that amount is what&apos;s owed.
      </p>

      {/* Range controls */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end', margin: '1rem 0' }}>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`btn btn-sm ${activePreset === p.id ? '' : 'btn-ghost'}`}
              onClick={() => applyPreset(p)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', marginLeft: 'auto' }}>
          <div>
            <label className="input-label">From</label>
            <input type="date" className="input" value={start} max={end} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <label className="input-label">To</label>
            <input type="date" className="input" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
      </div>

      {invalidRange ? (
        <p className="content-subtitle" style={{ margin: 0 }}>“To” date must be on or after the “From” date.</p>
      ) : isLoading ? (
        <Loader />
      ) : error ? (
        <p className="content-subtitle" style={{ margin: 0, color: 'var(--color-danger)' }}>{error.message}</p>
      ) : !dues ? null : (
        <>
          {/* Headline */}
          <div className="dues-headline">
            <div>
              <div className="dues-headline__label">Total owed to vendor</div>
              <div className="dues-headline__value">{money(dues.totalOwed)}</div>
              <div className="dues-headline__sub">
                {dayLabel(dues.startDate)} – {dayLabel(dues.endDate)}
              </div>
            </div>
            <div className="dues-breakdown">
              <div><span>Meals</span><strong>{money(dues.mealsSubtotal)}</strong></div>
              <div><span>Delivery</span><strong>{money(dues.delivery)}</strong></div>
              {dues.overrideCount > 0 && (
                <div>
                  <span>Vendor adjustments</span>
                  <strong style={{ color: dues.overrideDelta >= 0 ? 'var(--color-warning)' : 'var(--color-primary)' }}>
                    {dues.overrideDelta >= 0 ? '+' : '−'}{money(Math.abs(dues.overrideDelta))}
                  </strong>
                </div>
              )}
            </div>
          </div>

          {/* Reconciliation notes */}
          {(dues.overrideCount > 0 || dues.notSentCount > 0) && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              {dues.overrideCount > 0 && (
                <Badge variant="warning">
                  {dues.overrideCount} day{dues.overrideCount === 1 ? '' : 's'} the vendor set a different amount
                </Badge>
              )}
              {dues.notSentCount > 0 && (
                <Badge variant="default">{dues.notSentCount} day{dues.notSentCount === 1 ? '' : 's'} with no orders</Badge>
              )}
            </div>
          )}

          {rows.length === 0 ? (
            <div className="menu-empty">
              <p className="menu-empty__icon">🧾</p>
              <p style={{ margin: 0 }}>No orders were sent to the vendor in this range.</p>
            </div>
          ) : (
            <>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Day</Th>
                    <Th style={{ textAlign: 'right' }}>Meals</Th>
                    <Th style={{ textAlign: 'right' }}>Delivery</Th>
                    <Th style={{ textAlign: 'right' }}>Computed</Th>
                    <Th style={{ textAlign: 'right' }}>Vendor&apos;s amount</Th>
                    <Th style={{ textAlign: 'right' }}>Owed</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {rows.map((d) => (
                    <Tr key={d.date}>
                      <Td>
                        {dayLabel(d.date)}
                        {!d.sentToVendor && <span className="offer-hidden-tag">not sent</span>}
                      </Td>
                      <Td style={{ textAlign: 'right' }}>{d.mealsSubtotal > 0 ? money(d.mealsSubtotal) : '—'}</Td>
                      <Td style={{ textAlign: 'right' }}>{d.delivery > 0 ? money(d.delivery) : '—'}</Td>
                      <Td style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>{money(d.computedTotal)}</Td>
                      <Td style={{ textAlign: 'right' }}>
                        {d.vendorFinalAmount != null ? (
                          <span style={{ color: d.hasOverride ? 'var(--color-warning)' : undefined }}>
                            {money(d.vendorFinalAmount)}{d.hasOverride ? ' ⚑' : ''}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                        )}
                      </Td>
                      <Td style={{ textAlign: 'right', fontWeight: 700 }}>{money(d.owed)}</Td>
                    </Tr>
                  ))}
                  <Tr>
                    <Td style={{ fontWeight: 700 }}>Total</Td>
                    <Td style={{ textAlign: 'right', fontWeight: 700 }}>{money(dues.mealsSubtotal)}</Td>
                    <Td style={{ textAlign: 'right', fontWeight: 700 }}>{money(dues.delivery)}</Td>
                    <Td />
                    <Td />
                    <Td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--color-primary)' }}>
                      {money(dues.totalOwed)}
                    </Td>
                  </Tr>
                </Tbody>
              </Table>

              {(hiddenCount > 0 || showEmpty) && (
                <button type="button" className="link" style={{ marginTop: '0.75rem', fontSize: '0.8125rem' }} onClick={() => setShowEmpty((s) => !s)}>
                  {showEmpty ? 'Hide days with no orders' : `Show ${hiddenCount} day${hiddenCount === 1 ? '' : 's'} with no orders`}
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
