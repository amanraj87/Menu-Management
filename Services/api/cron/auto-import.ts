import type { IncomingMessage, ServerResponse } from 'node:http'
import { connectDb } from '../../dist/db.js'
import { runAndRecordAutoImport, computeUpcomingWeekStart } from '../../dist/jobs/autoImport.js'

let dbReady: Promise<unknown> | null = null

/**
 * Vercel Cron entry point for the weekly meal auto-import.
 * Scheduled from vercel.json. Vercel injects `Authorization: Bearer <CRON_SECRET>`
 * when the CRON_SECRET env var is set — we reject anything else.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers['authorization'] !== `Bearer ${secret}`) {
    res.statusCode = 401
    res.end('Unauthorized')
    return
  }

  try {
    if (!dbReady) dbReady = connectDb()
    await dbReady
    const targetWeekStart = computeUpcomingWeekStart()
    const created = await runAndRecordAutoImport(targetWeekStart, 'vercel-cron')
    res.statusCode = 200
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ ok: true, targetWeekStart, created }))
  } catch (e) {
    res.statusCode = 500
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ ok: false, error: (e as Error).message }))
  }
}
