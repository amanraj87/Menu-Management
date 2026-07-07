import { useMemo, useState } from 'react'
import { Card, Tabs, Table, Thead, Tbody, Tr, Th, Td, Button, Modal, Input, Loader } from '@/shared/ui'
import type { TabItem } from '@/shared/ui'
import type { MealType } from '@/shared/types'
import type { MenuItem } from '@/shared/types'
import { useMenuItems, useCreateMenuItem, useUpdateMenuItem, useDeleteMenuItem } from '@/shared/graphql/hooks'
import { useToastStore } from '@/shared/stores/toastStore'

const MEALS: { id: MealType; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
]

const MEAL_LABEL: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
}

const UNIT_OPTIONS = ['portion', 'piece', 'kg', 'plate', 'bowl']

/** A distinct dish in the shared menu, plus which meals it is currently served in. */
type CatalogDish = { name: string; unit: string; pricePerUnit?: number; meals: MealType[] }

export function VendorMenuManager() {
  const [activeTab, setActiveTab] = useState<MealType>('breakfast')
  const [modalOpen, setModalOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [formName, setFormName] = useState('')
  const [formMealType, setFormMealType] = useState<MealType>('breakfast')
  const [formUnit, setFormUnit] = useState('portion')
  const [formPricePerUnit, setFormPricePerUnit] = useState('')
  const [priceDraft, setPriceDraft] = useState<Record<string, string>>({})
  const toast = useToastStore()

  function resetForm() {
    setFormName('')
    setFormMealType('breakfast')
    setFormUnit('portion')
    setFormPricePerUnit('')
    setEditing(null)
  }

  const { items: allItems, isLoading } = useMenuItems()
  const { createMenuItem, isPending: createPending } = useCreateMenuItem(
    () => { setModalOpen(false); resetForm(); toast.add('Item added.', 'success') },
    (e) => toast.add(e.message, 'error')
  )
  const { updateMenuItem, isPending: updatePending } = useUpdateMenuItem(
    () => { setModalOpen(false); setEditing(null); resetForm(); toast.add('Item updated.', 'success') },
    (e) => toast.add(e.message, 'error')
  )
  // Separate instance for inline price edits in the Full-menu popup (no modal close).
  const { updateMenuItem: updatePrice } = useUpdateMenuItem(
    () => toast.add('Price saved.', 'success'),
    (e) => toast.add(e.message, 'error')
  )
  const { deleteMenuItem, isPending: deletePending } = useDeleteMenuItem(
    () => toast.add('Item removed.', 'success'),
    (e) => toast.add(e.message, 'error')
  )

  // Shared menu = all distinct dishes (by name), with the meals they appear in.
  const catalog: CatalogDish[] = useMemo(() => {
    const map = new Map<string, CatalogDish>()
    for (const it of allItems) {
      const key = it.name.trim().toLowerCase()
      const existing = map.get(key)
      if (existing) {
        if (!existing.meals.includes(it.mealType)) existing.meals.push(it.mealType)
      } else {
        map.set(key, { name: it.name, unit: it.unit, pricePerUnit: it.pricePerUnit, meals: [it.mealType] })
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [allItems])

  const openAddForMeal = (meal: MealType) => {
    resetForm()
    setFormMealType(meal)
    setEditing(null)
    setModalOpen(true)
  }

  const openMenu = () => {
    resetForm()
    setPriceDraft({})
    setMenuOpen(true)
  }

  const openEdit = (item: MenuItem) => {
    setEditing(item)
    setFormName(item.name)
    setFormMealType(item.mealType)
    setFormUnit(item.unit)
    setFormPricePerUnit(item.pricePerUnit != null ? String(item.pricePerUnit) : '')
    setModalOpen(true)
  }

  // Dishes from the shared menu that are NOT yet in the meal being added to.
  const pickableForMeal = useMemo(
    () => catalog.filter((d) => !d.meals.includes(formMealType)),
    [catalog, formMealType]
  )

  const applyDishFromMenu = (name: string) => {
    const dish = catalog.find((d) => d.name === name)
    if (!dish) return
    setFormName(dish.name)
    setFormUnit(dish.unit)
    setFormPricePerUnit(dish.pricePerUnit != null ? String(dish.pricePerUnit) : '')
  }

  const submitForm = (): boolean => {
    const name = formName.trim()
    if (!name) { toast.add('Enter a dish name.', 'warning'); return false }
    const price = formPricePerUnit.trim() === '' ? undefined : Number(formPricePerUnit)
    if (price !== undefined && (Number.isNaN(price) || price < 0)) { toast.add('Price must be a number.', 'warning'); return false }
    if (editing) {
      updateMenuItem(editing._id, { name, mealType: formMealType, unit: formUnit, pricePerUnit: price })
      return true
    }
    const dup = allItems.some(
      (i) => i.mealType === formMealType && i.name.trim().toLowerCase() === name.toLowerCase()
    )
    if (dup) { toast.add(`"${name}" is already in ${MEAL_LABEL[formMealType]}.`, 'warning'); return false }
    createMenuItem({ name, mealType: formMealType, unit: formUnit, pricePerUnit: price })
    return true
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    submitForm()
  }

  const commitPrice = (item: MenuItem) => {
    const raw = priceDraft[item._id]
    if (raw === undefined) return
    setPriceDraft((prev) => { const next = { ...prev }; delete next[item._id]; return next })
    const trimmed = raw.trim()
    if (trimmed === '') return // leave blank prices unchanged
    const price = Number(trimmed)
    if (Number.isNaN(price) || price < 0) { toast.add('Price must be a number.', 'warning'); return }
    if (price === (item.pricePerUnit ?? null)) return // unchanged
    updatePrice(item._id, { name: item.name, mealType: item.mealType, unit: item.unit, pricePerUnit: price })
  }

  const renderMealTab = (meal: MealType) => {
    const itemsForMeal = allItems.filter((i: MenuItem) => i.mealType === meal)
    return (
      <>
        {itemsForMeal.length === 0 ? (
          <p className="content-subtitle" style={{ margin: '0.5rem 0 1rem' }}>
            No items in {MEAL_LABEL[meal]} yet. Add one below.
          </p>
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Unit</Th>
                <Th>Price per unit</Th>
                <Th aria-label="Edit" />
                <Th aria-label="Remove" />
              </Tr>
            </Thead>
            <Tbody>
              {itemsForMeal.map((row: MenuItem) => (
                <Tr key={row._id}>
                  <Td>{row.name}</Td>
                  <Td>{row.unit}</Td>
                  <Td>{row.pricePerUnit != null ? row.pricePerUnit : '—'}</Td>
                  <Td>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(row)}>Edit</button>
                  </Td>
                  <Td>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => deleteMenuItem(row._id)}
                      disabled={deletePending}
                    >
                      Remove
                    </button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
        <Button variant="outline" onClick={() => openAddForMeal(meal)} style={{ marginTop: '1rem' }}>
          + Add item to {MEAL_LABEL[meal]}
        </Button>
      </>
    )
  }

  const tabs: TabItem[] = MEALS.map((m) => ({
    id: m.id,
    label: m.label,
    content: activeTab === m.id ? renderMealTab(m.id) : <div />,
  }))

  return (
    <Card className="content-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h3 className="card-title" style={{ marginTop: 0 }}>Update menu</h3>
          <p className="content-subtitle" style={{ margin: 0 }}>
            Add dishes to Breakfast, Lunch or Dinner. The same dish can be reused across meals.
          </p>
        </div>
        <Button variant="outline" onClick={openMenu}>📖 Full menu</Button>
      </div>

      <div style={{ marginTop: '1rem' }}>
        {isLoading ? (
          <Loader />
        ) : (
          <Tabs tabs={tabs} activeId={activeTab} onSelect={(id) => setActiveTab(id as MealType)} />
        )}
      </div>

      {/* Add / edit a single item (from a meal tab) */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); resetForm(); }}
        title={editing ? 'Edit menu item' : `Add item to ${MEAL_LABEL[formMealType]}`}
        footer={null}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {!editing && (
            <div>
              <label className="input-label">Choose from menu</label>
              <select
                value=""
                onChange={(e) => { if (e.target.value) applyDishFromMenu(e.target.value) }}
                className="input"
                style={{ width: '100%' }}
              >
                <option value="">
                  {pickableForMeal.length > 0 ? 'Pick an existing dish…' : 'No other dishes yet'}
                </option>
                {pickableForMeal.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.name}{d.pricePerUnit != null ? ` — ${d.pricePerUnit}/${d.unit}` : ` (${d.unit})`}
                  </option>
                ))}
              </select>
              <p className="content-subtitle" style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem' }}>
                …or type a new dish below.
              </p>
            </div>
          )}
          <Input
            label="Name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="e.g. Chicken Biryani"
            required
          />
          <div>
            <label className="input-label">Meal type</label>
            <select
              value={formMealType}
              onChange={(e) => setFormMealType(e.target.value as MealType)}
              className="input"
              style={{ width: '100%' }}
            >
              {MEALS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="input-label">Unit</label>
            <select
              value={formUnit}
              onChange={(e) => setFormUnit(e.target.value)}
              className="input"
              style={{ width: '100%' }}
            >
              {UNIT_OPTIONS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <Input
            label="Price per unit"
            type="number"
            min={0}
            step={0.01}
            value={formPricePerUnit}
            onChange={(e) => setFormPricePerUnit(e.target.value)}
            placeholder="e.g. 50"
          />
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createPending || updatePending}>
              {editing ? 'Update' : 'Add'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Full menu popup: whole menu, editable prices, add a dish */}
      <Modal open={menuOpen} onClose={() => setMenuOpen(false)} title="Full menu" footer={null}>
        <form
          onSubmit={(e) => { e.preventDefault(); submitForm() }}
          style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}
        >
          <strong style={{ fontSize: '0.9375rem' }}>Add a dish</strong>
          <div>
            <label className="input-label">Choose from menu</label>
            <select
              value=""
              onChange={(e) => { if (e.target.value) applyDishFromMenu(e.target.value) }}
              className="input"
              style={{ width: '100%' }}
            >
              <option value="">
                {pickableForMeal.length > 0 ? 'Reuse an existing dish…' : 'No other dishes yet'}
              </option>
              {pickableForMeal.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name}{d.pricePerUnit != null ? ` — ${d.pricePerUnit}/${d.unit}` : ` (${d.unit})`}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="e.g. Chicken Biryani"
          />
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 120 }}>
              <label className="input-label">Meal</label>
              <select
                value={formMealType}
                onChange={(e) => setFormMealType(e.target.value as MealType)}
                className="input"
                style={{ width: '100%' }}
              >
                {MEALS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <label className="input-label">Unit</label>
              <select
                value={formUnit}
                onChange={(e) => setFormUnit(e.target.value)}
                className="input"
                style={{ width: '100%' }}
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div style={{ width: 110 }}>
              <Input
                label="Price"
                type="number"
                min={0}
                step={0.01}
                value={formPricePerUnit}
                onChange={(e) => setFormPricePerUnit(e.target.value)}
                placeholder="e.g. 50"
              />
            </div>
          </div>
          <div>
            <Button type="submit" disabled={createPending}>+ Add dish</Button>
          </div>
        </form>

        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
          {allItems.length === 0 ? (
            <p className="content-subtitle" style={{ margin: 0 }}>No dishes yet. Add your first one above.</p>
          ) : (
            MEALS.map((m) => {
              const rows = allItems.filter((i) => i.mealType === m.id)
              return (
                <div key={m.id} style={{ marginBottom: '1.25rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem', color: 'var(--color-text)' }}>{m.label}</h4>
                  {rows.length === 0 ? (
                    <p className="content-subtitle" style={{ margin: 0, fontSize: '0.8125rem' }}>No items.</p>
                  ) : (
                    rows.map((item) => (
                      <div
                        key={item._id}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.4rem 0', borderBottom: '1px solid var(--color-border)' }}
                      >
                        <span style={{ flex: 1 }}>
                          {item.name}{' '}
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>({item.unit})</span>
                        </span>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          className="input input-qty"
                          style={{ width: 90, textAlign: 'center' }}
                          placeholder="price"
                          aria-label={`Price for ${item.name} (${m.label})`}
                          value={priceDraft[item._id] ?? (item.pricePerUnit != null ? String(item.pricePerUnit) : '')}
                          onChange={(e) => setPriceDraft((prev) => ({ ...prev, [item._id]: e.target.value }))}
                          onBlur={() => commitPrice(item)}
                        />
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => deleteMenuItem(item._id)}
                          disabled={deletePending}
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )
            })
          )}
        </div>
      </Modal>
    </Card>
  )
}
