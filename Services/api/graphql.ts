import 'dotenv/config'
import { connectDb } from '../dist/db.js'
import { yoga } from '../dist/app.js'

/** Allow up to 15s for cold start + MongoDB connection (Vercel Pro: up to 300s). */
export const maxDuration = 15

/** Vercel serverless handler: GraphQL at /api/graphql */
export default async function handler(request: Request): Promise<Response> {
  try {
    if (request.method !== 'OPTIONS') await connectDb()
    return await yoga.fetch(request)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: 'Function failed', message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
