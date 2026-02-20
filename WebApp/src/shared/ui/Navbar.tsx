import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

interface NavItem {
  to: string
  label: string
}

interface NavbarProps {
  brand: ReactNode
  items: NavItem[]
  end?: ReactNode
}

export function Navbar({ brand, items, end }: NavbarProps) {
  return (
    <nav className="navbar">
      <div className="navbar-brand">{brand}</div>
      <ul className="navbar-menu">
        {items.map((item) => (
          <li key={item.to}>
            <Link to={item.to} className="navbar-link">{item.label}</Link>
          </li>
        ))}
      </ul>
      {end && <div className="navbar-end">{end}</div>}
    </nav>
  )
}
