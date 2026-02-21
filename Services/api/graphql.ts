import type { IncomingMessage, ServerResponse } from 'node:http'
import { createSchema, createYoga } from 'graphql-yoga'
import { typeDefs } from '../dist/schema.js'
import { resolvers } from '../dist/resolvers/index.js'
import { createContext } from '../dist/context.js'
import { connectDb } from '../dist/db.js'

const yoga = createYoga({
  schema: createSchema({ typeDefs, resolvers }),
  context: async ({ request }) => createContext(request),
  graphiql: true,
  maskedErrors: false,
})

let dbReady: Promise<unknown> | null = null

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!dbReady) dbReady = connectDb()
  await dbReady
  await yoga.handle(req, res)
}
