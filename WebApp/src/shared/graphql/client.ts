import { ApolloClient, InMemoryCache, HttpLink, ApolloLink, from } from '@apollo/client'
import { useUIStore } from '@/shared/stores/uiStore'

const graphqlUri = import.meta.env.VITE_GRAPHQL_URL ?? 'http://localhost:4000/graphql'

const httpLink = new HttpLink({ uri: graphqlUri })

const authLink = new ApolloLink((operation, forward) => {
  const userId = useUIStore.getState().userSession?.userId
  operation.setContext((prev: { headers?: Record<string, string> }) => ({
    headers: {
      ...prev.headers,
      ...(userId ? { 'X-User-Id': userId } : {}),
    },
  }))
  return forward(operation)
})

export const apolloClient = new ApolloClient({
  link: from([authLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: { fetchPolicy: 'cache-and-network' },
    query: { fetchPolicy: 'cache-first' },
  },
})
