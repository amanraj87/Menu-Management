import { useState } from 'react'
import { Card, Tabs, Table, Thead, Tbody, Tr, Th, Td, Loader } from '@/shared/ui'
import type { TabItem } from '@/shared/ui'
import type { MealType, MenuItem } from '@/shared/types'
import { useMenuItems } from '@/shared/graphql/hooks'

const MEALS: { id: MealType; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
]

export function ViewMenu() {
  const [mealTab, setMealTab] = useState<MealType>('breakfast')
  const { items: allItems, isLoading } = useMenuItems()
  const items = allItems.filter((i: MenuItem) => i.mealType === mealTab)

  const content = isLoading ? (
    <Loader />
  ) : items.length === 0 ? (
    <p className="content-subtitle" style={{ marginBottom: 0 }}>No menu items for this meal yet.</p>
  ) : (
    <Table>
      <Thead>
        <Tr>
          <Th>Name</Th>
          <Th>Unit</Th>
          <Th>Price per unit</Th>
        </Tr>
      </Thead>
      <Tbody>
        {items.map((row: MenuItem) => (
          <Tr key={row._id}>
            <Td>{row.name}</Td>
            <Td>{row.unit}</Td>
            <Td>{row.pricePerUnit != null ? row.pricePerUnit : '—'}</Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  )

  const tabs: TabItem[] = MEALS.map((m) => ({
    id: m.id,
    label: m.label,
    content: mealTab === m.id ? content : <div />,
  }))

  return (
    <Card className="content-card" title="Menu (read-only)">
      <p className="content-subtitle">
        View menu items. Only vendor can add or edit the menu.
      </p>
      <Tabs tabs={tabs} activeId={mealTab} onSelect={(id) => setMealTab(id as MealType)} />
    </Card>
  )
}
