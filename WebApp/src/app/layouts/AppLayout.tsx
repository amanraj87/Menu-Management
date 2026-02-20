import { Outlet } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toast } from '@/shared/ui'
import { useToastStore } from '@/shared/stores/toastStore'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60 * 1000 },
  },
})

function AppContent() {
  const { toasts, dismiss } = useToastStore()
  return (
    <>
      <Outlet />
      <Toast toasts={toasts} onDismiss={dismiss} />
    </>
  )
}

export function AppLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  )
}
