import { create } from 'zustand'

interface UIState {
  sidebarOpen: boolean
  selectedDay: string | null
  selectedMeal: string | null
  userSession: { role: 'admin' | 'vendor'; name?: string } | null
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setSelectedDay: (day: string | null) => void
  setSelectedMeal: (meal: string | null) => void
  setUserSession: (session: UIState['userSession']) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  selectedDay: null,
  selectedMeal: null,
  userSession: null,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSelectedDay: (day) => set({ selectedDay: day }),
  setSelectedMeal: (meal) => set({ selectedMeal: meal }),
  setUserSession: (userSession) => set({ userSession }),
}))
