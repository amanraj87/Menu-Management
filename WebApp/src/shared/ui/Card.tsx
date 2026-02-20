import type { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string
}

export function Card({ title, children, className = '', ...props }: CardProps) {
  return (
    <div className={`card-ui ${className}`.trim()} {...props}>
      {title && <h3 className="card-title">{title}</h3>}
      {children}
    </div>
  )
}
