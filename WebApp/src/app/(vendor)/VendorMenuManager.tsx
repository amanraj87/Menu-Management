import { useMemo, useState } from 'react'
import { useApolloClient } from '@apollo/client/react'
import { Badge, Card, Table, Thead, Tbody, Tr, Th, Td, Button, Input, Loader, Modal } from '@/shared/ui'
import type { MealType, MenuItem } from '@/shared/types'
import { useMenuItems } from '@/shared/graphql/hooks'
import { CREATE_MENU_ITEM, UPDATE_MENU_ITEM, DELETE_MENU_ITEM, MENU_ITEMS } from '@/shared/graphql/operations'
import { useToastStore } from '@/shared/stores/toastStore'

const ALL_MEALS: MealType[] = ['breakfast', 'lunch', 'dinner']
const UNIT_OPTIONS = ['portion', 'piece', 'kg', 'plate', 'bowl']

const mealLabel = (m: MealType) => m.charAt(0).toUpperCase() + m.slice(1)
/** Sort a set of meals into canonical breakfast → lunch → dinner order. */
const sortMeals = (meals: MealType[]) => ALL_MEALS.filter((m) => meals.includes(m))

const EditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
)

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
)

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
)

/** A distinct dish in the shared menu and its underlying per-meal MenuItem records. */
type CatalogDish = {
  name: string
  unit: string
  pricePerUnit?: number
  meals: MealType[]
  items: MenuItem[]
}

export function VendorMenuManager() {
  const [formOpen, setFormOpen] = useState(false)
  const [editingDish, setEditingDish] = useState<CatalogDish | null>(null)
  const [formName, setFormName] = useState('')
  const [formUnit, setFormUnit] = useState('portion')
  const [formPricePerUnit, setFormPricePerUnit] = useState('')
  const [formMeals, setFormMeals] = useState<MealType[]>(ALL_MEALS)
  const [menuSearch, setMenuSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const toast = useToastStore()
  const client = useApolloClient()

  const { items: allItems, isLoading } = useMenuItems()

  function resetForm() {
    setFormName('')
    setFormUnit('portion')
    setFormPricePerUnit('')
    setFormMeals(ALL_MEALS)
    setEditingDish(null)
  }

  const toggleFormMeal = (m: MealType) =>
    setFormMeals((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : sortMeals([...prev, m])))

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
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [allItems])

  const menuFiltered = useMemo(() => {
    const q = menuSearch.trim().toLowerCase()
    return q ? catalog.filter((d) => d.name.toLowerCase().includes(q)) : catalog
  }, [catalog, menuSearch])

  const unitOptions = useMemo(() => {
    const set = new Set<string>(UNIT_OPTIONS)
    allItems.forEach((i) => { if (i.unit) set.add(i.unit) })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [allItems])

  const openAdd = () => { resetForm(); setFormOpen(true) }

  const openEditDish = (dish: CatalogDish) => {
    setEditingDish(dish)
    setFormName(dish.name)
    setFormUnit(dish.unit)
    setFormPricePerUnit(dish.pricePerUnit != null ? String(dish.pricePerUnit) : '')
    setFormMeals(sortMeals(dish.meals))
    setFormOpen(true)
  }

  const parsePrice = (): number | undefined | null => {
    const t = formPricePerUnit.trim()
    if (t === '') return undefined
    const v = Number(t)
    if (Number.isNaN(v) || v < 0) return null // invalid
    return v
  }

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = formName.trim()
    if (!name) { toast.add('Enter a dish name.', 'warning'); return }
    const price = parsePrice()
    if (price === null) { toast.add('Price must be a number.', 'warning'); return }
    if (price === undefined) { toast.add('Enter a price per unit.', 'warning'); return }
    const unit = formUnit.trim() || 'portion'
    if (formMeals.length === 0) { toast.add('Pick at least one meal type.', 'warning'); return }

    setBusy(true)
    try {
      if (editingDish) {
        // Reconcile this dish's per-meal records against the selected meals:
        // create newly-added meals, delete removed ones, update the rest.
        const existingByMeal = new Map(editingDish.items.map((r) => [r.mealType, r]))
        for (const mealType of formMeals) {
          const rec = existingByMeal.get(mealType)
          if (rec) {
            await client.mutate({
              mutation: UPDATE_MENU_ITEM,
              variables: { id: rec._id, input: { name, mealType, unit, pricePerUnit: price } },
            })
          } else {
            await client.mutate({
              mutation: CREATE_MENU_ITEM,
              variables: { input: { name, mealType, unit, pricePerUnit: price } },
            })
          }
        }
        for (const rec of editingDish.items) {
          if (!formMeals.includes(rec.mealType)) {
            await client.mutate({ mutation: DELETE_MENU_ITEM, variables: { id: rec._id } })
          }
        }
        toast.add('Dish updated.', 'success')
      } else {
        const dup = catalog.some((d) => d.name.trim().toLowerCase() === name.toLowerCase())
        if (dup) { toast.add(`"${name}" is already on the menu.`, 'warning'); setBusy(false); return }
        // Create a record for each selected meal type.
        for (const mealType of formMeals) {
          await client.mutate({
            mutation: CREATE_MENU_ITEM,
            variables: { input: { name, mealType, unit, pricePerUnit: price } },
          })
        }
        toast.add('Dish added.', 'success')
      }
      await client.refetchQueries({ include: [MENU_ITEMS] })
      setFormOpen(false)
      resetForm()
    } catch (err) {
      toast.add((err as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const removeDish = async (dish: CatalogDish) => {
    if (!window.confirm(`Remove "${dish.name}" from the menu?`)) return
    setBusy(true)
    try {
      for (const rec of dish.items) {
        await client.mutate({ mutation: DELETE_MENU_ITEM, variables: { id: rec._id } })
      }
      await client.refetchQueries({ include: [MENU_ITEMS] })
      toast.add('Dish removed.', 'success')
    } catch (err) {
      toast.add((err as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="content-card">
      <datalist id="unit-options">
        {unitOptions.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h3 className="card-title" style={{ marginTop: 0 }}>Menu</h3>
          <p className="content-subtitle" style={{ margin: 0 }}>
            Your full list of dishes. Choose which meals each dish is available for.
          </p>
        </div>
        <Button onClick={openAdd}>+ Add new dish</Button>
      </div>

      <Modal
        open={formOpen}
        onClose={() => { setFormOpen(false); resetForm() }}
        title={editingDish ? `Edit “${editingDish.name}”` : 'Add a dish'}
        footer={null}
      >
        <form
          onSubmit={submitForm}
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
          <Input
            label="Name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="e.g. Chicken Biryani"
            required
          />
          <div>
            <label className="input-label">Available for</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {ALL_MEALS.map((m) => {
                const active = formMeals.includes(m)
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggleFormMeal(m)}
                    aria-pressed={active}
                    className={`btn btn-sm ${active ? '' : 'btn-ghost'}`}
                  >
                    {active ? '✓ ' : ''}{mealLabel(m)}
                  </button>
                )
              })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
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
                required
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <Button type="button" variant="ghost" onClick={() => { setFormOpen(false); resetForm() }}>Cancel</Button>
            <Button type="submit" disabled={busy}>{editingDish ? 'Save' : 'Add dish'}</Button>
          </div>
        </form>
      </Modal>

      {isLoading ? (
        <Loader />
      ) : (
        <>
          {catalog.length > 0 && (
            <div className="menu-toolbar">
              <div className="menu-search">
                <span className="menu-search__icon"><SearchIcon /></span>
                <Input
                  type="search"
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  placeholder="Search dishes…"
                />
              </div>
              <span className="menu-count">
                {menuFiltered.length} dish{menuFiltered.length !== 1 ? 'es' : ''}
              </span>
            </div>
          )}

          {catalog.length === 0 ? (
            <div className="menu-empty">
              <p className="menu-empty__icon">🍽️</p>
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)' }}>Your menu is empty</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem' }}>Tap “Add new dish” to create your first dish.</p>
            </div>
          ) : menuFiltered.length === 0 ? (
            <div className="menu-empty">
              <p className="menu-empty__icon">🔎</p>
              <p style={{ margin: 0 }}>No dishes match “{menuSearch.trim()}”.</p>
            </div>
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Dish</Th>
                  <Th>Meals</Th>
                  <Th>Unit</Th>
                  <Th>Price</Th>
                  <Th aria-label="Actions" />
                </Tr>
              </Thead>
              <Tbody>
                {menuFiltered.map((dish) => {
                  const meals = sortMeals(dish.meals)
                  return (
                    <Tr key={dish.name}>
                      <Td>{dish.name}</Td>
                      <Td>
                        <span style={{ display: 'inline-flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                          {meals.length === ALL_MEALS.length ? (
                            <Badge variant="info">All meals</Badge>
                          ) : (
                            meals.map((m) => (
                              <Badge key={m} variant="default">{mealLabel(m)}</Badge>
                            ))
                          )}
                        </span>
                      </Td>
                      <Td>{dish.unit}</Td>
                      <Td>{dish.pricePerUnit != null ? `₹${dish.pricePerUnit}` : '—'}</Td>
                      <Td>
                        <span style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="icon-btn icon-btn--edit"
                            onClick={() => openEditDish(dish)}
                            title={`Edit ${dish.name}`}
                            aria-label={`Edit ${dish.name}`}
                          >
                            <EditIcon />
                          </button>
                          <button
                            type="button"
                            className="icon-btn icon-btn--danger"
                            onClick={() => removeDish(dish)}
                            disabled={busy}
                            title={`Remove ${dish.name}`}
                            aria-label={`Remove ${dish.name}`}
                          >
                            <TrashIcon />
                          </button>
                        </span>
                      </Td>
                    </Tr>
                  )
                })}
              </Tbody>
            </Table>
          )}
        </>
      )}
    </Card>
  )
}
