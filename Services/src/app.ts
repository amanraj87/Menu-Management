import { createSchema, createYoga } from 'graphql-yoga'
import { typeDefs } from './schema.js'
import { resolvers } from './resolvers/index.js'
import { createContext } from './context.js'

/** Shared Yoga instance for both Node server and Vercel serverless. */
export const yoga = createYoga({
  schema: createSchema({ typeDefs, resolvers }),
  context: async ({ request }) => createContext(request),
  graphiql: true,
  maskedErrors: false,
})
