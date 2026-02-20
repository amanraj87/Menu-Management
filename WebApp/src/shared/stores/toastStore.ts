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

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  add: (message, variant) =>
    set((s) => ({
      toasts: [...s.toasts, { id: nextId(), message, variant }],
    })),
  dismiss: (id) =>
    set((s) => ({
      toasts: s.toasts.filter((t) => t.id !== id),
    })),
}))
