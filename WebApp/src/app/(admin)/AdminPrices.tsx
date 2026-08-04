import { useState } from 'react'
import { Card, Tabs } from '@/shared/ui'
import type { TabItem } from '@/shared/ui'
import { AdminPriceHistory } from './AdminPriceHistory'
import { AdminVendorDues } from './AdminVendorDues'

type PriceTab = 'dues' | 'history'

/** Admin money screen: what's owed to the vendor + the price-change log. */
export function AdminPrices() {
  const [tab, setTab] = useState<PriceTab>('dues')

  const tabs: TabItem[] = [
    { id: 'dues', label: 'Vendor dues', content: tab === 'dues' ? <AdminVendorDues /> : <div /> },
    { id: 'history', label: 'Price history', content: tab === 'history' ? <AdminPriceHistory /> : <div /> },
  ]

  return (
    <Card className="content-card">
      <Tabs tabs={tabs} activeId={tab} onSelect={(id) => setTab(id as PriceTab)} />
    </Card>
  )
}
