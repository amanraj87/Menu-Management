import { Link, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'

interface SideItem {
  to: string
  label: string
  icon?: ReactNode
}

interface SidebarProps {
  items: SideItem[]
  open: boolean
  onClose?: () => void
  header?: ReactNode
}

export function Sidebar({ items, open, onClose, header }: SidebarProps) {
  const location = useLocation()
  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} aria-hidden="true" />}
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        {header && <div className="sidebar-header">{header}</div>}
        <ul className="sidebar-menu">
          {items.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className={`sidebar-link ${location.pathname === item.to ? 'sidebar-link-active' : ''}`}
                onClick={onClose}
              >
                {item.icon && <span className="sidebar-icon">{item.icon}</span>}
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </aside>
    </>
  )
}
