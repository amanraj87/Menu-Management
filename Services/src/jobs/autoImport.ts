import { getDb } from '../db.js'
import { COLLECTIONS } from '../constants/collections.js'
import type { SelectionDoc, ContextUser } from '../types.js'

/* ------------------------------------------------------------------ */
/* Date helpers (Monday-based weeks, timezone-stable)                  */
/* ------------------------------------------------------------------ */

function toLocalISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Monday (YYYY-MM-DD) of the week containing the given date. */
function mondayOfISO(d: Date): string {
  const x = new Date(d)
  const day = x.getDay() // 0 = Sun ... 6 = Sat
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff)
  return toLocalISO(x)
}

/** Add n days to a YYYY-MM-DD string using UTC-only math (no tz drift). */
function addDaysISO(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/* ------------------------------------------------------------------ */
/* Core: copy last week's selections into the upcoming week            */
/* ------------------------------------------------------------------ */

/**
 * Copies each user's selections from `sourceWeekStart` into the week starting
 * `targetWeekStart` (dates shifted +7 days). Only fills slots that have NO
 * items yet in the target week — never overwrites a user's own planning.
 * Returns the number of selection slots created.
 */
export async function runWeeklyAutoImport(targetWeekStart: string): Promise<number> {
  const db = getDb()
  const sourceWeekStart = addDaysISO(targetWeekStart, -7)

  const sourceDates = Array.from({ length: 7 }, (_, i) => addDaysISO(sourceWeekStart, i))
  const targetDates = Array.from({ length: 7 }, (_, i) => addDaysISO(targetWeekStart, i))

  const [sourceSelections, targetSelections] = await Promise.all([
    db.collection(COLLECTIONS.selections).find({ date: { $in: sourceDates } }).toArray() as Promise<SelectionDoc[]>,
    db.collection(COLLECTIONS.selections).find({ date: { $in: targetDates } }).toArray() as Promise<SelectionDoc[]>,
  ])

  // Slots that already have items in the target week — leave these untouched.
  const targetHasItems = new Set(
    targetSelections
      .filter(s => s.items.length > 0)
      .map(s => `${s.userId.toString()}|${s.date}|${s.mealType}`),
  )

  let created = 0
  const now = new Date()
  for (const s of sourceSelections) {
    if (s.items.length === 0) continue
    const targetDate = addDaysISO(s.date, 7)
    const key = `${s.userId.toString()}|${targetDate}|${s.mealType}`
    if (targetHasItems.has(key)) continue

    await db.collection(COLLECTIONS.selections).updateOne(
      { userId: s.userId, date: targetDate, mealType: s.mealType },
      { $set: { items: s.items, updatedAt: now } },
      { upsert: true },
    )
    created++
  }
  return created
}

/** Monday (YYYY-MM-DD) of next week, relative to now. */
export function computeUpcomingWeekStart(): string {
  return addDaysISO(mondayOfISO(new Date()), 7)
}

/**
 * Admin-triggered manual run of the weekly auto-import (for testing / catch-up).
 * Defaults to the upcoming week when no target is given.
 */
export async function runAutoImport(
  _: unknown,
  args: { targetWeekStart?: string | null },
  context: { user?: ContextUser },
): Promise<number> {
  const user = context.user
  if (!user || user.role !== 'admin') throw new Error('Unauthorized: admin role required')
  const target = args.targetWeekStart || computeUpcomingWeekStart()
  return runWeeklyAutoImport(target)
}

/* ------------------------------------------------------------------ */
/* Scheduler                                                           */
/* ------------------------------------------------------------------ */

const JOB_ID = 'weekly_auto_import'
const TICK_MS = 60 * 60 * 1000 // check hourly

async function maybeRun(): Promise<void> {
  if (process.env.DISABLE_AUTO_IMPORT === 'true') return

  const now = new Date()
  const day = now.getDay() // 0 = Sun ... 6 = Sat
  // Run over the weekend (Sat/Sun) so next week is ready before Monday.
  if (day !== 6 && day !== 0) return

  const targetWeekStart = addDaysISO(mondayOfISO(now), 7)

  const db = getDb()
  const jobs = db.collection(COLLECTIONS.job_runs)
  const marker = await jobs.findOne({ _id: JOB_ID as unknown as never })
  if (marker && (marker as { lastWeek?: string }).lastWeek === targetWeekStart) return

  const created = await runWeeklyAutoImport(targetWeekStart)
  await jobs.updateOne(
    { _id: JOB_ID as unknown as never },
    { $set: { lastWeek: targetWeekStart, ranAt: now, created } },
    { upsert: true },
  )
  console.log(`[auto-import] Imported ${created} selection slot(s) into week of ${targetWeekStart}`)
}

/** Starts the weekly auto-import scheduler (runs once on boot, then hourly). */
export function startAutoImportScheduler(): void {
  const tick = () => { maybeRun().catch(err => console.error('[auto-import] failed:', err)) }
  tick()
  setInterval(tick, TICK_MS)
}
