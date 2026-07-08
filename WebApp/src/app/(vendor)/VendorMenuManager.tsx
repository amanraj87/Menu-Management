import { useMemo, useState } from 'react'
import { useApolloClient } from '@apollo/client/react'
import { Card, Tabs, Table, Thead, Tbody, Tr, Th, Td, Button, Modal, Input, Loader } from '@/shared/ui'
import type { TabItem } from '@/shared/ui'
import type { MealType } from '@/shared/types'
import type { MenuItem } from '@/shared/types'
import { useMenuItems, useCreateMenuItem, useUpdateMenuItem, useDeleteMenuItem } from '@/shared/graphql/hooks'
import { UPDATE_MENU_ITEM, DELETE_MENU_ITEM, MENU_ITEMS } from '@/shared/graphql/operations'
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

/** A distinct dish in the shared menu, the meals it is served in, and the
 *  underlying per-meal MenuItem records (one dish can span several meals). */
type CatalogDish = {
  name: string
  unit: string
  pricePerUnit?: number
  meals: MealType[]
  items: MenuItem[]
}

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
  const [editing, setEditing] = useState<MenuItem | null>(null)         // per-meal single-record edit
  const [editingDish, setEditingDish] = useState<CatalogDish | null>(null) // full-menu dish edit (all meals)
  const [formName, setFormName] = useState('')
  const [formMealType, setFormMealType] = useState<MealType>('breakfast')
  const [formUnit, setFormUnit] = useState('portion')
  const [formPricePerUnit, setFormPricePerUnit] = useState('')
  const [menuSearch, setMenuSearch] = useState('')
  const [addSearch, setAddSearch] = useState('')
  const [dishBusy, setDishBusy] = useState(false)
  const toast = useToastStore()
  const client = useApolloClient()

  function resetForm() {
    setFormName('')
    setFormMealType('breakfast')
    setFormUnit('portion')
    setFormPricePerUnit('')
    setEditing(null)
    setEditingDish(null)
  }

  const { items: allItems, isLoading } = useMenuItems()
  const { createMenuItem, isPending: createPending } = useCreateMenuItem(
    () => { setMenuFormOpen(false); resetForm(); toast.add('Item added.', 'success') },
    (e) => toast.add(e.message, 'error')
  )
  const { updateMenuItem, isPending: updatePending } = useUpdateMenuItem(
    () => { setModalOpen(false); resetForm(); toast.add('Item updated.', 'success') },
    (e) => toast.add(e.message, 'error')
  )
  const { deleteMenuItem, isPending: deletePending } = useDeleteMenuItem(
    () => toast.add('Item removed.', 'success'),
    (e) => toast.add(e.message, 'error')
  )
  // Adds an existing dish to a meal from the picker (keeps the modal open for more).
  const { createMenuItem: addExistingToMeal, isPending: addingExisting } = useCreateMenuItem(
    () => toast.add('Added.', 'success'),
    (e) => toast.add(e.message, 'error')
  )

  // Shared menu = distinct dishes (by name), each with its meals + records.
  const catalog: CatalogDish[] = useMemo(() => {
    const map = new Map<string, CatalogDish>()
    for (const it of allItems) {
      const key = it.name.trim().toLowerCase()
      const existing = map.get(key)
      if (existing) {
        existing.items.push(it)
        if (!existing.meals.includes(it.mealType)) existing.meals.push(it.mealType)
      } else {
        map.set(key, { name: it.name, unit: it.unit, pricePerUnit: it.pricePerUnit, meals: [it.mealType], items: [it] })
      }
    }
    for (const d of map.values()) {
      d.meals.sort((a, b) => MEALS.findIndex((m) => m.id === a) - MEALS.findIndex((m) => m.id === b))
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [allItems])

  const menuFiltered = useMemo(() => {
    const q = menuSearch.trim().toLowerCase()
    return q ? catalog.filter((d) => d.name.toLowerCase().includes(q)) : catalog
  }, [catalog, menuSearch])

  // Units suggested in the type-ahead: the defaults plus any already in use.
  const unitOptions = useMemo(() => {
    const set = new Set<string>(UNIT_OPTIONS)
    allItems.forEach((i) => { if (i.unit) set.add(i.unit) })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [allItems])

  const openAddForMeal = (meal: MealType) => {
    resetForm()
    setFormMealType(meal)
    setAddSearch('')
    setModalOpen(true)
  }

  const addDishToMeal = (dish: CatalogDish) => {
    addExistingToMeal({ name: dish.name, mealType: formMealType, unit: dish.unit, pricePerUnit: dish.pricePerUnit })
  }

  const openMenu = () => {
    resetForm()
    setMenuFormOpen(false)
    setMenuSearch('')
    setMenuOpen(true)
  }

  const openAddInMenu = () => {
    resetForm()
    setMenuFormOpen(true)
  }

  const openEditDish = (dish: CatalogDish) => {
    setEditing(null)
    setEditingDish(dish)
    setFormName(dish.name)
    setFormUnit(dish.unit)
    setFormPricePerUnit(dish.pricePerUnit != null ? String(dish.pricePerUnit) : '')
    setMenuFormOpen(true)
  }

  const openEdit = (item: MenuItem) => {
    setEditingDish(null)
    setEditing(item)
    setFormName(item.name)
    setFormMealType(item.mealType)
    setFormUnit(item.unit)
    setFormPricePerUnit(item.pricePerUnit != null ? String(item.pricePerUnit) : '')
    setModalOpen(true)
  }

  // Dishes NOT yet in the meal being added to (per-meal picker).
  const pickableForMeal = useMemo(
    () => catalog.filter((d) => !d.meals.includes(formMealType)),
    [catalog, formMealType]
  )
  const addQuery = addSearch.trim().toLowerCase()
  const pickList = addQuery
    ? pickableForMeal.filter((d) => d.name.toLowerCase().includes(addQuery))
    : pickableForMeal

  const parsePrice = (): number | undefined | null => {
    const t = formPricePerUnit.trim()
    if (t === '') return undefined
    const v = Number(t)
    if (Number.isNaN(v) || v < 0) return null // invalid
    return v
  }

  // Per-meal single-record edit (from a meal tab)
  const submitEdit = (e: React.FormEvent) => {
    e.preventDefault()
    const name = formName.trim()
    if (!name) { toast.add('Enter a dish name.', 'warning'); return }
    const price = parsePrice()
    if (price === null) { toast.add('Price must be a number.', 'warning'); return }
    const unit = formUnit.trim() || 'portion'
    if (editing) updateMenuItem(editing._id, { name, mealType: formMealType, unit, pricePerUnit: price })
  }

  // Full-menu inline form: add a new dish, or edit a dish across all its meals.
  const submitMenuForm = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = formName.trim()
    if (!name) { toast.add('Enter a dish name.', 'warning'); return }
    const price = parsePrice()
    if (price === null) { toast.add('Price must be a number.', 'warning'); return }
    const unit = formUnit.trim() || 'portion'

    if (editingDish) {
      setDishBusy(true)
      try {
        for (const rec of editingDish.items) {
          await client.mutate({
            mutation: UPDATE_MENU_ITEM,
            variables: { id: rec._id, input: { name, mealType: rec.mealType, unit, pricePerUnit: price } },
          })
        }
        await client.refetchQueries({ include: [MENU_ITEMS] })
        toast.add('Dish updated.', 'success')
        setMenuFormOpen(false)
        resetForm()
      } catch (err) {
        toast.add((err as Error).message, 'error')
      } finally {
        setDishBusy(false)
      }
      return
    }

    const dup = allItems.some(
      (i) => i.mealType === formMealType && i.name.trim().toLowerCase() === name.toLowerCase()
    )
    if (dup) { toast.add(`"${name}" is already in ${MEAL_LABEL[formMealType]}.`, 'warning'); return }
    createMenuItem({ name, mealType: formMealType, unit, pricePerUnit: price })
  }

  const removeDish = async (dish: CatalogDish) => {
    const where = dish.meals.map((m) => MEAL_LABEL[m]).join(', ')
    if (!window.confirm(`Remove "${dish.name}" from ${where}?`)) return
    setDishBusy(true)
    try {
      for (const rec of dish.items) {
        await client.mutate({ mutation: DELETE_MENU_ITEM, variables: { id: rec._id } })
      }
      await client.refetchQueries({ include: [MENU_ITEMS] })
      toast.add('Dish removed.', 'success')
    } catch (err) {
      toast.add((err as Error).message, 'error')
    } finally {
      setDishBusy(false)
    }
  }

  /** Name / (optional meal) / unit / price fields. Unit is a type-ahead so any custom unit works. */
  const renderFormFields = (showMeal: boolean) => (
    <>
      <Input
        label="Name"
        value={formName}
        onChange={(e) => setFormName(e.target.value)}
        placeholder="e.g. Chicken Biryani"
        required
      />
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {showMeal && (
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
        )}
        <div style={{ flex: 1, minWidth: 130 }}>
          <label className="input-label">Unit</label>
          <input
            list="unit-options"
            className="input"
            style={{ width: '100%' }}
            value={formUnit}
            onChange={(e) => setFormUnit(e.target.value)}
            placeholder="e.g. portion (type any)"
          />
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
      <datalist id="unit-options">
        {unitOptions.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>

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

      {/* Add (pick from menu) / edit a single item (from a meal tab) */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); resetForm(); }}
        title={editing ? 'Edit menu item' : `Add item to ${MEAL_LABEL[formMealType]}`}
        footer={null}
      >
        {editing ? (
          <form onSubmit={submitEdit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {renderFormFields(true)}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={updatePending}>Update</Button>
            </div>
          </form>
        ) : catalog.length === 0 ? (
          <p className="content-subtitle" style={{ margin: 0 }}>
            Your menu is empty. Open <strong>Full menu → Add new dish</strong> to create dishes first,
            then add them to meals here.
          </p>
        ) : (
          <>
            <p className="content-subtitle" style={{ marginTop: 0 }}>
              Pick a dish from your menu to serve in {MEAL_LABEL[formMealType]}.
            </p>
            <Input
              type="search"
              value={addSearch}
              onChange={(e) => setAddSearch(e.target.value)}
              placeholder="Search dishes…"
            />
            {pickList.length === 0 ? (
              <p className="content-subtitle" style={{ marginBottom: 0 }}>
                {addQuery
                  ? `No dishes match “${addSearch.trim()}”.`
                  : `Every dish is already in ${MEAL_LABEL[formMealType]}.`}
              </p>
            ) : (
              <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', marginTop: '0.25rem' }}>
                {pickList.map((d, i) => (
                  <button
                    type="button"
                    key={d.name}
                    onClick={() => addDishToMeal(d)}
                    disabled={addingExisting}
                    style={{
                      display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between',
                      gap: '1rem', padding: '0.6rem 0.9rem', background: 'none', border: 'none',
                      borderTop: i > 0 ? '1px solid var(--color-border)' : 'none', color: 'var(--color-text)',
                      cursor: 'pointer', textAlign: 'left', font: 'inherit',
                    }}
                  >
                    <span>
                      {d.name}{' '}
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                        ({d.unit}{d.pricePerUnit != null ? ` · ${d.pricePerUnit}` : ''})
                      </span>
                    </span>
                    <span style={{ color: 'var(--color-primary)', fontWeight: 600, whiteSpace: 'nowrap' }}>+ Add</span>
                  </button>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>Done</Button>
            </div>
          </>
        )}
      </Modal>

      {/* Full menu popup: one row per dish (meal badges), add/edit inline */}
      <Modal open={menuOpen} onClose={() => { setMenuOpen(false); setMenuFormOpen(false); resetForm() }} title="Full menu" footer={null} wide>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <span className="content-subtitle" style={{ margin: 0 }}>
            {catalog.length} {catalog.length === 1 ? 'dish' : 'dishes'}
          </span>
          {!menuFormOpen && (
            <Button onClick={openAddInMenu}>+ Add new dish</Button>
          )}
        </div>

        {catalog.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <Input
              type="search"
              value={menuSearch}
              onChange={(e) => setMenuSearch(e.target.value)}
              placeholder="Search dishes…"
            />
          </div>
        )}

        {menuFormOpen && (
          <form
            onSubmit={submitMenuForm}
            style={{
              display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem',
              marginBottom: '1.25rem', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)', background: 'var(--color-bg)',
            }}
          >
            <strong style={{ fontSize: '0.9375rem' }}>{editingDish ? `Edit “${editingDish.name}”` : 'Add a dish'}</strong>
            {renderFormFields(false)}
            {editingDish && (
              <p className="content-subtitle" style={{ margin: 0, fontSize: '0.8125rem' }}>
                Applies to: {editingDish.meals.map((m) => MEAL_LABEL[m]).join(', ')}
              </p>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <Button type="button" variant="ghost" onClick={() => { setMenuFormOpen(false); resetForm() }}>Cancel</Button>
              <Button type="submit" disabled={createPending || dishBusy}>
                {editingDish ? 'Save' : 'Add dish'}
              </Button>
            </div>
          </form>
        )}

        {catalog.length === 0 ? (
          <p className="content-subtitle" style={{ margin: 0 }}>No dishes yet. Tap “Add new dish” to create one.</p>
        ) : menuFiltered.length === 0 ? (
          <p className="content-subtitle" style={{ margin: 0 }}>No dishes match “{menuSearch.trim()}”.</p>
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Dish</Th>
                <Th>Served in</Th>
                <Th>Unit</Th>
                <Th>Price</Th>
                <Th aria-label="Edit" />
                <Th aria-label="Remove" />
              </Tr>
            </Thead>
            <Tbody>
              {menuFiltered.map((dish) => (
                <Tr key={dish.name}>
                  <Td>{dish.name}</Td>
                  <Td>
                    <span style={{ display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                      {dish.meals.map((m) => <MealPill key={m} meal={m} />)}
                    </span>
                  </Td>
                  <Td>{dish.unit}</Td>
                  <Td>{dish.pricePerUnit != null ? dish.pricePerUnit : '—'}</Td>
                  <Td>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEditDish(dish)}>Edit</button>
                  </Td>
                  <Td>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeDish(dish)} disabled={dishBusy}>Remove</button>
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
