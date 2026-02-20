import type { ReactNode } from 'react'

export interface TabItem {
  id: string
  label: string
  content: ReactNode
}

interface TabsProps {
  tabs: TabItem[]
  activeId: string
  onSelect: (id: string) => void
  className?: string
}

export function Tabs({ tabs, activeId, onSelect, className = '' }: TabsProps) {
  return (
    <div className={`tabs-ui ${className}`.trim()}>
      <div className="tabs-list" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeId === tab.id}
            className={`tabs-trigger ${activeId === tab.id ? 'tabs-trigger-active' : ''}`}
            onClick={() => onSelect(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="tabs-panel" role="tabpanel">
        {tabs.find((t) => t.id === activeId)?.content}
      </div>
    </div>
  )
}
