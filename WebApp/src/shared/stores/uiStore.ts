import { create } from 'zustand'

const SESSION_KEY = 'menu-user-session'

type Session = { userId?: string; role?: 'person' | 'admin' | 'vendor'; name?: string } | null

function getStoredSession(): Session {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as Session
    return data && typeof data === 'object' && data.userId && data.role ? data : null
  } catch {
    return null
  }
}

function setStoredSession(session: Session) {
  if (typeof window === 'undefined') return
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  else localStorage.removeItem(SESSION_KEY)
}

interface UIState {
  sidebarOpen: boolean
  selectedDay: string | null
  selectedMeal: string | null
  userSession: Session
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setSelectedDay: (day: string | null) => void
  setSelectedMeal: (meal: string | null) => void
  setUserSession: (session: Session) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  selectedDay: null,
  selectedMeal: null,
  userSession: getStoredSession(),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSelectedDay: (day) => set({ selectedDay: day }),
  setSelectedMeal: (meal) => set({ selectedMeal: meal }),
  setUserSession: (userSession) => {
    setStoredSession(userSession)
    set({ userSession })
  },
}))
