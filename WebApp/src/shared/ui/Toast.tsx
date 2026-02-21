import type { ReactNode } from 'react'

type ToastVariant = 'success' | 'error' | 'info' | 'warning'

export interface ToastItem {
  id: string
  message: ReactNode
  variant?: ToastVariant
}

interface ToastProps {
  toasts: ToastItem[]
  onDismiss: (id: string) => void
}

const variantClass: Record<ToastVariant, string> = {
  success: 'toast-success',
  error: 'toast-error',
  info: 'toast-info',
  warning: 'toast-warning',
}

export function Toast({ toasts, onDismiss }: ToastProps) {
  if (toasts.length === 0) return null
  return (
    <div className="toast-container" role="region" aria-label="Notifications">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast ${variantClass[t.variant ?? 'info']}`}
          role="alert"
        >
          <span className="toast-message">{t.message}</span>
          <button type="button" className="toast-dismiss" onClick={() => onDismiss(t.id)} aria-label="Dismiss">&times;</button>
        </div>
      ))}
    </div>
  )
}
