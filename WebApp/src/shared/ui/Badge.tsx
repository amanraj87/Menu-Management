import type { HTMLAttributes } from 'react'

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant
}

const variantClass: Record<Variant, string> = {
  default: 'badge-default',
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
  info: 'badge-info',
}

export function Badge({ variant = 'default', className = '', children, ...props }: BadgeProps) {
  return (
    <span
      className={`badge ${variantClass[variant]} ${className}`.trim()}
      {...props}
    >
      {children}
    </span>
  )
}
