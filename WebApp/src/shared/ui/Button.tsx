import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
}

const variantClass: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  outline: 'btn-outline',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
}

const sizeClass = { sm: 'btn-sm', md: 'btn-md', lg: 'btn-lg' }

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`btn ${variantClass[variant]} ${sizeClass[size]} ${fullWidth ? 'btn-full' : ''} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  )
}
