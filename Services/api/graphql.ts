import 'dotenv/config'
import { connectDb } from '../dist/db.js'
import { yoga } from '../dist/app.js'

/** Vercel serverless handler: GraphQL at /api/graphql */
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'OPTIONS') await connectDb()
  return yoga.handle(request)
}
