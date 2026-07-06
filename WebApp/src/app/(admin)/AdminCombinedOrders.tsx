import { useState, useEffect } from 'react'
import { useApolloClient } from '@apollo/client/react'
import { Card, Button, Loader, Table, Thead, Tbody, Tr, Th, Td } from '@/shared/ui'
import type { MealType } from '@/shared/types'
import { useAggregatedOrder, useConfirmOrderWithItems, useMenuItems } from '@/shared/graphql/hooks'
import { AGGREGATED_ORDER, CONFIRM_ORDER_WITH_ITEMS, CONFIRMED_ORDERS } from '@/shared/graphql/operations'
import { useToastStore } from '@/shared/stores/toastStore'

type AddedItem = { menuItemId: string; name: string; unit: string; quantity: number }

const MEALS: { id: MealType; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
]

function toDateString(d: Date) {
  return d.toISOString().slice(0, 10)
}

const pad = (n: number) => String(n).padStart(2, '0')
function fmtLocal(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
/** Add days to a YYYY-MM-DD string, staying in local time. */
function addDaysStr(iso: string, n: number) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + n)
  return fmtLocal(dt)
}
/** Monday of the week containing the given YYYY-MM-DD string. */
function mondayOfStr(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const day = dt.getDay() // 0 = Sun
  dt.setDate(dt.getDate() + (day === 0 ? -6 : 1 - day))
  return fmtLocal(dt)
}
function prettyDay(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export function AdminCombinedOrders() {
  const [date, setDate] = useState(() => toDateString(new Date()))
  const [meal, setMeal] = useState<MealType>('lunch')
  const [editedQty, setEditedQty] = useState<Record<string, number>>({})
  const [draftQty, setDraftQty] = useState<Record<string, string>>({})
  const [removedIds, setRemovedIds] = useState<Record<string, boolean>>({})
  const [addedItems, setAddedItems] = useState<AddedItem[]>([])
  const toast = useToastStore()
  const client = useApolloClient()

  const [weekStart, setWeekStart] = useState(() => mondayOfStr(fmtLocal(new Date())))
  const [weekPending, setWeekPending] = useState(false)
  const [weekProgress, setWeekProgress] = useState('')

  const { aggregated, isLoading } = useAggregatedOrder(date, meal)
  const { items: menuItemsForMeal } = useMenuItems(meal)
  const { confirmOrderWithItems, isPending: confirmPending } = useConfirmOrderWithItems(
    () => toast.add('Order confirmed. Vendor can see it.', 'success'),
    (e) => toast.add(e.message, 'error')
  )

  const items = aggregated?.items ?? []
  const itemsKey = items.map((i) => `${i.menuItemId}:${i.quantity}`).join('|')
  useEffect(() => {
    const next: Record<string, number> = {}
    items.forEach((row) => {
      next[row.menuItemId] = row.quantity
    })
    setEditedQty((prev) => ({ ...prev, ...next }))
    setDraftQty({})
    setRemovedIds({})
    setAddedItems([])
  }, [date, meal, itemsKey])

  const existingRows = items.filter((r) => !removedIds[r.menuItemId])
  const displayRows: Array<{ menuItemId: string; name: string; unit: string; quantity: number; personBreakdown: Array<{ userName: string; quantity: number }> }> = [
    ...existingRows,
    ...addedItems.map((a) => ({ ...a, personBreakdown: [] })),
  ]
  const sourceQty = (menuItemId: string) =>
    items.find((r) => r.menuItemId === menuItemId)?.quantity ?? addedItems.find((a) => a.menuItemId === menuItemId)?.quantity ?? 0

  const commitDraftQty = (menuItemId: string) => {
    const raw = draftQty[menuItemId]
    setDraftQty((prev) => { const next = { ...prev }; delete next[menuItemId]; return next })
    const fallback = sourceQty(menuItemId)
    if (raw === undefined || raw === '') {
      setEditedQty((prev) => ({ ...prev, [menuItemId]: fallback }))
      return
    }
    const v = Number(raw)
    setEditedQty((prev) => ({ ...prev, [menuItemId]: Number.isNaN(v) || v < 0 ? 0 : v }))
  }

  const handleSendEdited = () => {
    const payload = displayRows.map((row) => ({
      menuItemId: row.menuItemId,
      name: row.name,
      unit: row.unit,
      quantity: editedQty[row.menuItemId] ?? row.quantity,
    }))
    confirmOrderWithItems(date, meal, payload)
  }

  /** Confirm every day's breakfast/lunch/dinner for the selected week, using
   *  each meal's aggregated selections as-is. Meals with no selections are skipped. */
  const handleConfirmWeek = async () => {
    const days = Array.from({ length: 7 }, (_, i) => addDaysStr(weekStart, i))
    const combos = days.flatMap((d) => MEALS.map((m) => ({ date: d, meal: m.id })))
    setWeekPending(true)
    setWeekProgress('')
    let confirmed = 0
    let skipped = 0
    let done = 0
    try {
      for (const { date: d, meal: m } of combos) {
        const res = await client.query<{ aggregatedOrder: { items: AddedItem[] } | null }>({
          query: AGGREGATED_ORDER,
          variables: { date: d, mealType: m },
          fetchPolicy: 'network-only',
        })
        const aggItems = res.data?.aggregatedOrder?.items ?? []
        if (aggItems.length === 0) {
          skipped++
        } else {
          await client.mutate({
            mutation: CONFIRM_ORDER_WITH_ITEMS,
            variables: {
              date: d,
              mealType: m,
              items: aggItems.map((i) => ({
                menuItemId: i.menuItemId,
                name: i.name,
                unit: i.unit,
                quantity: i.quantity,
              })),
            },
          })
          confirmed++
        }
        done++
        setWeekProgress(`Processing ${done}/${combos.length}…`)
      }
      await client.refetchQueries({ include: [AGGREGATED_ORDER, CONFIRMED_ORDERS] })
      toast.add(
        confirmed > 0
          ? `Confirmed ${confirmed} meal${confirmed === 1 ? '' : 's'} for the week (${skipped} had no selections).`
          : 'No selections found for any meal this week.',
        confirmed > 0 ? 'success' : 'info'
      )
    } catch (e) {
      toast.add((e as Error).message, 'error')
    } finally {
      setWeekPending(false)
      setWeekProgress('')
    }
  }

  const handleRemove = (menuItemId: string) => {
    if (addedItems.some((a) => a.menuItemId === menuItemId)) {
      setAddedItems((prev) => prev.filter((a) => a.menuItemId !== menuItemId))
      setEditedQty((prev) => { const next = { ...prev }; delete next[menuItemId]; return next })
      setDraftQty((prev) => { const next = { ...prev }; delete next[menuItemId]; return next })
    } else {
      setRemovedIds((prev) => ({ ...prev, [menuItemId]: true }))
    }
  }

  const [addItemId, setAddItemId] = useState('')
  const [addItemQty, setAddItemQty] = useState('1')
  const displayIds = new Set(displayRows.map((r) => r.menuItemId))
  const unselectedMenuItems = menuItemsForMeal.filter((m) => !displayIds.has(m._id))
  const handleAddItem = () => {
    const menuItem = menuItemsForMeal.find((m) => m._id === addItemId)
    if (!menuItem) return
    const qty = Number(addItemQty)
    if (Number.isNaN(qty) || qty <= 0) return
    setAddedItems((prev) => [...prev, { menuItemId: menuItem._id, name: menuItem.name, unit: menuItem.unit, quantity: qty }])
    setEditedQty((prev) => ({ ...prev, [menuItem._id]: qty }))
    setAddItemId('')
    setAddItemQty('1')
  }

  const weekEnd = addDaysStr(weekStart, 6)

  const hasDisplayRows = displayRows.length > 0

  return (
    <>
      <Card className="content-card" title="Confirm the whole week">
        <p className="content-subtitle">
          Confirm every day&apos;s breakfast, lunch, and dinner for a full week at once, using what
          people selected. Meals with no selections are skipped. Use the section below to review or
          edit a single meal instead.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '1rem' }}>
          <div>
            <label className="content-label">Week starting (Mon)</label>
            <input
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(mondayOfStr(e.target.value))}
              className="input"
              style={{ minWidth: 160 }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <span className="content-subtitle" style={{ display: 'block' }}>
              {prettyDay(weekStart)} – {prettyDay(weekEnd)}
            </span>
            {weekProgress && (
              <span className="content-subtitle" style={{ display: 'block' }}>{weekProgress}</span>
            )}
          </div>
          <Button onClick={handleConfirmWeek} disabled={weekPending}>
            {weekPending ? 'Confirming week…' : 'Confirm all meals for the week'}
          </Button>
        </div>
      </Card>

      <Card className="content-card" title="Combined orders — review or edit a single meal">
        <p className="content-subtitle">
          Select date and meal. See combined quantities and who chose what. Edit totals if needed, then send to vendor.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label className="content-label">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input"
              style={{ minWidth: 160 }}
            />
          </div>
          <div>
            <label className="content-label">Meal</label>
            <select
              value={meal}
              onChange={(e) => setMeal(e.target.value as MealType)}
              className="input"
              style={{ minWidth: 140 }}
            >
              {MEALS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>
        {isLoading ? (
          <Loader />
        ) : !hasDisplayRows && items.length === 0 ? (
          <>
            <p className="content-subtitle" style={{ marginBottom: '1rem' }}>No selections for this date and meal yet.</p>
            {unselectedMenuItems.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '0.5rem', marginBottom: '1rem' }}>
                <label className="content-label" style={{ display: 'block', width: '100%' }}>Add item</label>
                <select
                  value={addItemId}
                  onChange={(e) => setAddItemId(e.target.value)}
                  className="input"
                  style={{ minWidth: 160, fontSize: '0.875rem', color: addItemId ? undefined : 'var(--color-text-muted)' }}
                >
                  <option value="">Choose an item to add…</option>
                  {unselectedMenuItems.map((m) => (
                    <option key={m._id} value={m._id}>{m.name}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0.1}
                  step="0.1"
                  value={addItemQty}
                  onChange={(e) => setAddItemQty(e.target.value)}
                  className="input input-qty"
                  style={{ width: 72, textAlign: 'center' }}
                  aria-label="Quantity to add"
                />
                <Button onClick={handleAddItem} disabled={!addItemId}>Add</Button>
              </div>
            )}
            <Button onClick={handleSendEdited} disabled>
              Confirm
            </Button>
          </>
        ) : (
          <>
            <Table>
              <Thead>
                <Tr>
                  <Th>Item</Th>
                  <Th>Unit</Th>
                  <Th>Total qty (editable)</Th>
                  <Th>Who chose what</Th>
                  <Th style={{ width: 80 }}></Th>
                </Tr>
              </Thead>
              <Tbody>
                {displayRows.map((row) => (
                  <Tr key={row.menuItemId}>
                    <Td>{row.name}</Td>
                    <Td>{row.unit}</Td>
                    <Td>
                      <input
                        type="number"
                        min={0}
                        step="0.1"
                        value={draftQty[row.menuItemId] ?? editedQty[row.menuItemId] ?? row.quantity}
                        onChange={(e) => setDraftQty((prev) => ({ ...prev, [row.menuItemId]: e.target.value }))}
                        onBlur={() => commitDraftQty(row.menuItemId)}
                        className="input input-qty"
                        style={{ width: 72, textAlign: 'center' }}
                        aria-label={`Quantity for ${row.name}`}
                      />
                    </Td>
                    <Td>
                      <span style={{ fontSize: '0.875rem' }}>
                        {row.personBreakdown.length > 0
                          ? row.personBreakdown.map((p) => `${p.userName}: ${p.quantity}`).join(', ')
                          : '—'}
                      </span>
                    </Td>
                    <Td>
                      <button
                        type="button"
                        onClick={() => handleRemove(row.menuItemId)}
                        className="link"
                        style={{ fontSize: '0.875rem' }}
                      >
                        Remove
                      </button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
            {unselectedMenuItems.length > 0 && (
              <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '0.5rem' }}>
                <label className="content-label" style={{ display: 'block', width: '100%' }}>Add item</label>
                <select
                  value={addItemId}
                  onChange={(e) => setAddItemId(e.target.value)}
                  className="input"
                  style={{ minWidth: 160, fontSize: '0.875rem', color: addItemId ? undefined : 'var(--color-text-muted)' }}
                >
                  <option value="">Choose an item to add…</option>
                  {unselectedMenuItems.map((m) => (
                    <option key={m._id} value={m._id}>{m.name}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0.1}
                  step="0.1"
                  value={addItemQty}
                  onChange={(e) => setAddItemQty(e.target.value)}
                  className="input input-qty"
                  style={{ width: 72, textAlign: 'center' }}
                  aria-label="Quantity to add"
                />
                <Button onClick={handleAddItem} disabled={!addItemId}>
                  Add
                </Button>
              </div>
            )}
            <div style={{ marginTop: '1rem' }}>
              <Button onClick={handleSendEdited} disabled={confirmPending}>
                {confirmPending ? 'Confirming…' : 'Confirm'}
              </Button>
            </div>
          </>
        )}
      </Card>
    </>
  )
}
