import 'dotenv/config'
import { createServer } from 'node:http'
import { yoga } from './app.js'
import { connectDb, closeDb } from './db.js'

const server = createServer(yoga)
const port = Number(process.env.PORT) || 4000

async function main() {
  await connectDb()
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
