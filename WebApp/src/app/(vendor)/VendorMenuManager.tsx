import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, Tabs, Table, Thead, Tbody, Tr, Th, Td, Button, Modal, Input, Loader } from '@/shared/ui'
import type { TabItem } from '@/shared/ui'
import type { MealType } from '@/shared/types'
import type { MenuItem } from '@/shared/types'
import { api } from '@/shared/api/client'
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
  const [formUnit, setFormUnit] = useState('portion')
  const [formDefaultQty, setFormDefaultQty] = useState(1)
  const queryClient = useQueryClient()
  const toast = useToastStore()

  const { data: menuData, isLoading } = useQuery({
    queryKey: ['menu-items'],
    queryFn: () => api.getMenuItems(),
  })

  const createMutation = useMutation({
    mutationFn: (body: { name: string; mealType: MealType; unit: string; defaultQuantity?: number }) =>
      api.createMenuItem({ ...body, mealType: mealTab }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items'] })
      setModalOpen(false)
      resetForm()
      toast.add('Item added.', 'success')
    },
    onError: (e: Error) => toast.add(e.message, 'error'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { name?: string; unit?: string; defaultQuantity?: number } }) =>
      api.updateMenuItem(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items'] })
      setModalOpen(false)
      setEditing(null)
      resetForm()
      toast.add('Item updated.', 'success')
    },
    onError: (e: Error) => toast.add(e.message, 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteMenuItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items'] })
      toast.add('Item removed.', 'success')
    },
    onError: (e: Error) => toast.add(e.message, 'error'),
  })

  function resetForm() {
    setFormName('')
    setFormUnit('portion')
    setFormDefaultQty(1)
    setEditing(null)
  }

  const openAdd = () => {
    resetForm()
    setEditing(null)
    setModalOpen(true)
  }

  const openEdit = (item: MenuItem) => {
    setEditing(item)
    setFormName(item.name)
    setFormUnit(item.unit)
    setFormDefaultQty(item.defaultQuantity ?? 1)
    setModalOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editing) {
      updateMutation.mutate({
        id: editing._id,
        body: { name: formName, unit: formUnit, defaultQuantity: formDefaultQty },
      })
    } else {
      createMutation.mutate({
        name: formName,
        mealType: mealTab,
        unit: formUnit,
        defaultQuantity: formDefaultQty,
      })
    }
  }

  const allItems = menuData?.items ?? []
  const itemsForMeal = allItems.filter((i) => i.mealType === mealTab)

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
                <Th>Default qty</Th>
                <Th aria-label="Edit" />
                <Th aria-label="Remove" />
              </Tr>
            </Thead>
            <Tbody>
              {itemsForMeal.map((row) => (
                <Tr key={row._id}>
                  <Td>{row.name}</Td>
                  <Td>{row.unit}</Td>
                  <Td>{row.defaultQuantity ?? 1}</Td>
                  <Td>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(row)}>Edit</button>
                  </Td>
                  <Td>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => deleteMutation.mutate(row._id)}
                      disabled={deleteMutation.isPending}
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
          {!editing && (
            <Input
              label="Default quantity"
              type="number"
              min={1}
              value={formDefaultQty}
              onChange={(e) => setFormDefaultQty(Number(e.target.value) || 1)}
            />
          )}
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
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
