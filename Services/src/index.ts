import 'dotenv/config'
import { createSchema, createYoga } from 'graphql-yoga'
import { createServer } from 'node:http'
import { typeDefs } from './schema.js'
import { resolvers } from './resolvers/index.js'
import { connectDb, closeDb } from './db.js'
import { createContext } from './context.js'
import { startAutoImportScheduler } from './jobs/autoImport.js'

const yoga = createYoga({
  schema: createSchema({ typeDefs, resolvers }),
  context: async ({ request }) => createContext(request),
  graphiql: true,
  // Expose resolver error messages (e.g. Unauthorized, duplicate email) instead of "Unexpected error."
  maskedErrors: false,
})

const server = createServer(yoga)
const port = Number(process.env.PORT) || 4000

async function main() {
  await connectDb()
  startAutoImportScheduler()
  server.listen(port, () => {
    console.log(`GraphQL server: http://localhost:${port}/graphql`)
  })
}

process.on('SIGINT', async () => {
  await closeDb()
  process.exit(0)
})

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
