import type { ReactNode } from 'react'

interface LayoutProps {
  children: ReactNode
  className?: string
}

export function Layout({ children, className = '' }: LayoutProps) {
  return <div className={`layout ${className}`.trim()}>{children}</div>
}
