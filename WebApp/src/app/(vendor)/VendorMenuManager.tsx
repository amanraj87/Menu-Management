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

function MealPill({ meal }: { meal: MealType }) {
  return (
    <span
      style={{
        fontSize: '0.75rem',
        padding: '0.1rem 0.5rem',
        borderRadius: 999,
        background: 'rgba(34,197,94,0.14)',
        color: 'var(--color-primary)',
        whiteSpace: 'nowrap',
      }}
    >
      {MEAL_LABEL[meal]}
    </span>
  )
}

export function VendorMenuManager() {
  const [activeTab, setActiveTab] = useState<MealType>('breakfast')
  const [modalOpen, setModalOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuFormOpen, setMenuFormOpen] = useState(false)
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [formName, setFormName] = useState('')
  const [formMealType, setFormMealType] = useState<MealType>('breakfast')
  const [formUnit, setFormUnit] = useState('portion')
  const [formPricePerUnit, setFormPricePerUnit] = useState('')
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
    () => { setModalOpen(false); setMenuFormOpen(false); resetForm(); toast.add('Item added.', 'success') },
    (e) => toast.add(e.message, 'error')
  )
  const { updateMenuItem, isPending: updatePending } = useUpdateMenuItem(
    () => { setModalOpen(false); setMenuFormOpen(false); setEditing(null); resetForm(); toast.add('Item updated.', 'success') },
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

  // Flat, alphabetical list of every menu item for the full-menu popup.
  const allItemsSorted = useMemo(
    () => [...allItems].sort((a, b) => a.name.localeCompare(b.name) || a.mealType.localeCompare(b.mealType)),
    [allItems]
  )

  const openAddForMeal = (meal: MealType) => {
    resetForm()
    setFormMealType(meal)
    setEditing(null)
    setModalOpen(true)
  }

  const openMenu = () => {
    resetForm()
    setMenuFormOpen(false)
    setMenuOpen(true)
  }

  const openAddInMenu = () => {
    resetForm()
    setMenuFormOpen(true)
  }

  const openEditInMenu = (item: MenuItem) => {
    setEditing(item)
    setFormName(item.name)
    setFormMealType(item.mealType)
    setFormUnit(item.unit)
    setFormPricePerUnit(item.pricePerUnit != null ? String(item.pricePerUnit) : '')
    setMenuFormOpen(true)
  }

  const openEdit = (item: MenuItem) => {
    setEditing(item)
    setFormName(item.name)
    setFormMealType(item.mealType)
    setFormUnit(item.unit)
    setFormPricePerUnit(item.pricePerUnit != null ? String(item.pricePerUnit) : '')
    setModalOpen(true)
  }

  // Dishes from the shared menu that are NOT yet in the meal being added to (per-meal modal).
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

  const submitForm = () => {
    const name = formName.trim()
    if (!name) { toast.add('Enter a dish name.', 'warning'); return }
    const price = formPricePerUnit.trim() === '' ? undefined : Number(formPricePerUnit)
    if (price !== undefined && (Number.isNaN(price) || price < 0)) { toast.add('Price must be a number.', 'warning'); return }
    if (editing) {
      updateMenuItem(editing._id, { name, mealType: formMealType, unit: formUnit, pricePerUnit: price })
      return
    }
    const dup = allItems.some(
      (i) => i.mealType === formMealType && i.name.trim().toLowerCase() === name.toLowerCase()
    )
    if (dup) { toast.add(`"${name}" is already in ${MEAL_LABEL[formMealType]}.`, 'warning'); return }
    createMenuItem({ name, mealType: formMealType, unit: formUnit, pricePerUnit: price })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    submitForm()
  }

  /** Name / meal / unit / price fields shared by both the per-meal modal and the popup. */
  const formFields = (
    <>
      <Input
        label="Name"
        value={formName}
        onChange={(e) => setFormName(e.target.value)}
        placeholder="e.g. Chicken Biryani"
        required
      />
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 130 }}>
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
        <div style={{ flex: 1, minWidth: 130 }}>
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
        <div style={{ width: 130 }}>
          <label className="input-label">Price</label>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={formPricePerUnit}
            onChange={(e) => setFormPricePerUnit(e.target.value)}
            placeholder="e.g. 50"
          />
        </div>
      </div>
    </>
  )

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
          {formFields}
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createPending || updatePending}>
              {editing ? 'Update' : 'Add'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Full menu popup: flat list of every dish, add/edit inline */}
      <Modal open={menuOpen} onClose={() => { setMenuOpen(false); setMenuFormOpen(false); resetForm() }} title="Full menu" footer={null} wide>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <span className="content-subtitle" style={{ margin: 0 }}>
            {allItemsSorted.length} {allItemsSorted.length === 1 ? 'dish' : 'dishes'}
          </span>
          {!menuFormOpen && (
            <Button onClick={openAddInMenu}>+ Add new dish</Button>
          )}
        </div>

        {menuFormOpen && (
          <form
            onSubmit={handleSubmit}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              padding: '1rem',
              marginBottom: '1.25rem',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              background: 'var(--color-bg)',
            }}
          >
            <strong style={{ fontSize: '0.9375rem' }}>{editing ? 'Edit dish' : 'Add a dish'}</strong>
            {formFields}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <Button type="button" variant="ghost" onClick={() => { setMenuFormOpen(false); resetForm() }}>Cancel</Button>
              <Button type="submit" disabled={createPending || updatePending}>
                {editing ? 'Save' : 'Add dish'}
              </Button>
            </div>
          </form>
        )}

        {allItemsSorted.length === 0 ? (
          <p className="content-subtitle" style={{ margin: 0 }}>No dishes yet. Tap “Add new dish” to create one.</p>
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Dish</Th>
                <Th>Meal</Th>
                <Th>Unit</Th>
                <Th>Price</Th>
                <Th aria-label="Edit" />
                <Th aria-label="Remove" />
              </Tr>
            </Thead>
            <Tbody>
              {allItemsSorted.map((item) => (
                <Tr key={item._id}>
                  <Td>{item.name}</Td>
                  <Td><MealPill meal={item.mealType} /></Td>
                  <Td>{item.unit}</Td>
                  <Td>{item.pricePerUnit != null ? item.pricePerUnit : '—'}</Td>
                  <Td>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEditInMenu(item)}>Edit</button>
                  </Td>
                  <Td>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => deleteMenuItem(item._id)}
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
      </Modal>
    </Card>
  )
}
