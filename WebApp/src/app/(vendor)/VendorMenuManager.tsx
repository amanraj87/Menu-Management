import { useMemo, useState } from 'react'
import { useApolloClient } from '@apollo/client/react'
import { Card, Table, Thead, Tbody, Tr, Th, Td, Button, Input, Loader } from '@/shared/ui'
import type { MealType, MenuItem } from '@/shared/types'
import { useMenuItems } from '@/shared/graphql/hooks'
import { CREATE_MENU_ITEM, UPDATE_MENU_ITEM, DELETE_MENU_ITEM, MENU_ITEMS } from '@/shared/graphql/operations'
import { useToastStore } from '@/shared/stores/toastStore'

const ALL_MEALS: MealType[] = ['breakfast', 'lunch', 'dinner']
const UNIT_OPTIONS = ['portion', 'piece', 'kg', 'plate', 'bowl']

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
  const [menuSearch, setMenuSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const toast = useToastStore()
  const client = useApolloClient()

  const { items: allItems, isLoading } = useMenuItems()

  function resetForm() {
    setFormName('')
    setFormUnit('portion')
    setFormPricePerUnit('')
    setEditingDish(null)
  }

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
    const unit = formUnit.trim() || 'portion'

    setBusy(true)
    try {
      if (editingDish) {
        // Update every existing record for this dish (across whatever meals it's in).
        for (const rec of editingDish.items) {
          await client.mutate({
            mutation: UPDATE_MENU_ITEM,
            variables: { id: rec._id, input: { name, mealType: rec.mealType, unit, pricePerUnit: price } },
          })
        }
        toast.add('Dish updated.', 'success')
      } else {
        const dup = catalog.some((d) => d.name.trim().toLowerCase() === name.toLowerCase())
        if (dup) { toast.add(`"${name}" is already on the menu.`, 'warning'); setBusy(false); return }
        // A dish is available for every meal.
        for (const mealType of ALL_MEALS) {
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
            Your full list of dishes. Each dish is available for breakfast, lunch and dinner.
          </p>
        </div>
        {!formOpen && <Button onClick={openAdd}>+ Add new dish</Button>}
      </div>

      {isLoading ? (
        <Loader />
      ) : (
        <>
          {formOpen && (
            <form
              onSubmit={submitForm}
              style={{
                display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem',
                margin: '1rem 0 1.25rem', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)', background: 'var(--color-bg)',
              }}
            >
              <strong style={{ fontSize: '0.9375rem' }}>{editingDish ? `Edit “${editingDish.name}”` : 'Add a dish'}</strong>
              <Input
                label="Name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Chicken Biryani"
                required
              />
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
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <Button type="button" variant="ghost" onClick={() => { setFormOpen(false); resetForm() }}>Cancel</Button>
                <Button type="submit" disabled={busy}>{editingDish ? 'Save' : 'Add dish'}</Button>
              </div>
            </form>
          )}

          {catalog.length > 0 && (
            <div style={{ margin: '1rem 0' }}>
              <Input
                type="search"
                value={menuSearch}
                onChange={(e) => setMenuSearch(e.target.value)}
                placeholder="Search dishes…"
              />
            </div>
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
                    <Td>{dish.unit}</Td>
                    <Td>{dish.pricePerUnit != null ? dish.pricePerUnit : '—'}</Td>
                    <Td>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEditDish(dish)}>Edit</button>
                    </Td>
                    <Td>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeDish(dish)} disabled={busy}>Remove</button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </>
      )}
    </Card>
  )
}
