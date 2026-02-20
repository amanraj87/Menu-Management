import { Outlet } from 'react-router-dom'
import { ApolloProvider } from '@apollo/client/react'
import { apolloClient } from '@/shared/graphql/client'
import { Toast } from '@/shared/ui'
import { useToastStore } from '@/shared/stores/toastStore'

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
    <ApolloProvider client={apolloClient}>
      <AppContent />
    </ApolloProvider>
  )
}
