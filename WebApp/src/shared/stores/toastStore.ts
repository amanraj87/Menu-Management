import { create } from 'zustand'
import type { ToastItem } from '@/shared/ui'

interface ToastState {
  toasts: ToastItem[]
  add: (message: ToastItem['message'], variant?: ToastItem['variant']) => void
  dismiss: (id: string) => void
}

let id = 0
function nextId() {
  id += 1
  return `toast-${id}`
}

const AUTO_DISMISS_MS = 4000

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  add: (message, variant) => {
    const toastId = nextId()
    set((s) => ({
      toasts: [...s.toasts, { id: toastId, message, variant }],
    }))
    setTimeout(() => get().dismiss(toastId), AUTO_DISMISS_MS)
  },
  dismiss: (id) =>
    set((s) => ({
      toasts: s.toasts.filter((t) => t.id !== id),
    })),
}))
