import type { ReactNode } from 'react'

interface HeaderProps {
  title: string
  actions?: ReactNode
}

export function Header({ title, actions }: HeaderProps) {
  return (
    <header className="header-ui">
      <h1 className="header-title">{title}</h1>
      {actions && <div className="header-actions">{actions}</div>}
    </header>
  )
}
