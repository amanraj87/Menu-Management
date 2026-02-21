import { useState } from 'react'
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

const UNIT_OPTIONS = ['portion', 'piece', 'kg', 'plate', 'bowl']

export function VendorMenuManager() {
  const [mealTab, setMealTab] = useState<MealType>('breakfast')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [formName, setFormName] = useState('')
  const [formMealType, setFormMealType] = useState<MealType>('breakfast')
  const [formUnit, setFormUnit] = useState('portion')
  const [formPricePerUnit, setFormPricePerUnit] = useState('')
  const toast = useToastStore()

  const { items: allItems, isLoading } = useMenuItems()
  const { createMenuItem, isPending: createPending } = useCreateMenuItem(
    () => { setModalOpen(false); resetForm(); toast.add('Item added.', 'success') },
    (e) => toast.add(e.message, 'error')
  )
  const { updateMenuItem, isPending: updatePending } = useUpdateMenuItem(
    () => { setModalOpen(false); setEditing(null); resetForm(); toast.add('Item updated.', 'success') },
    (e) => toast.add(e.message, 'error')
  )
  const { deleteMenuItem, isPending: deletePending } = useDeleteMenuItem(
    () => toast.add('Item removed.', 'success'),
    (e) => toast.add(e.message, 'error')
  )

  function resetForm() {
    setFormName('')
    setFormMealType('breakfast')
    setFormUnit('portion')
    setFormPricePerUnit('')
    setEditing(null)
  }

  const openAdd = () => {
    resetForm()
    setFormMealType(mealTab)
    setEditing(null)
    setModalOpen(true)
  }

  const openEdit = (item: MenuItem) => {
    setEditing(item)
    setFormName(item.name)
    setFormMealType(item.mealType)
    setFormUnit(item.unit)
    setFormPricePerUnit(item.pricePerUnit != null ? String(item.pricePerUnit) : '')
    setModalOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const price = formPricePerUnit.trim() === '' ? undefined : Number(formPricePerUnit)
    if (editing) {
      updateMenuItem(editing._id, { name: formName, mealType: formMealType, unit: formUnit, pricePerUnit: price })
    } else {
      createMenuItem({ name: formName, mealType: formMealType, unit: formUnit, pricePerUnit: price })
    }
  }

  const itemsForMeal = allItems.filter((i: MenuItem) => i.mealType === mealTab)

  const tabContent = (
    <>
      {isLoading ? (
        <Loader />
      ) : (
        <>
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
          <Button variant="outline" onClick={openAdd} style={{ marginTop: '1rem' }}>
            + Add item
          </Button>
        </>
      )}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); resetForm(); }}
        title={editing ? 'Edit menu item' : 'Add menu item'}
        footer={null}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
    </>
  )

  const tabs: TabItem[] = MEALS.map((m) => ({
    id: m.id,
    label: m.label,
    content: mealTab === m.id ? tabContent : <div />,
  }))

  return (
    <Card title="Update menu">
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>
        Add, edit or remove items for each meal. People choose from this menu.
      </p>
      <Tabs tabs={tabs} activeId={mealTab} onSelect={(id) => setMealTab(id as MealType)} />
    </Card>
  )
}
