import { ObjectId } from 'mongodb'
import { getDb } from '../db.js'
import { COLLECTIONS } from '../constants/collections.js'
import { aggregatedOrder } from './orders.js'
import { sendToUsers } from '../services/fcm.js'
import type { ContextUser, MealType, MealDoneDoc, UserDoc } from '../types.js'

export async function myMealDoneForWeek(
  _: unknown,
  args: { startDate: string },
  context: { user?: ContextUser }
): Promise<Record<string, unknown>[]> {
  const user = context.user
  if (!user) return []
  const db = getDb()
  const start = new Date(args.startDate + 'T00:00:00')
  const dates: string[] = []
  for (let d = 0; d < 7; d++) {
    const date = new Date(start)
    date.setDate(start.getDate() + d)
    dates.push(date.toISOString().slice(0, 10))
  }
  const docs = await db.collection(COLLECTIONS.meal_done).find({
    userId: new ObjectId(user.userId),
    date: { $in: dates },
  }).toArray() as MealDoneDoc[]
  const userDoc = await db.collection(COLLECTIONS.users).findOne({ _id: new ObjectId(user.userId) }) as UserDoc | null
  const userName = userDoc?.name ?? 'Unknown'
  return docs.map(doc => ({
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    userName,
    date: doc.date,
    mealType: doc.mealType,
    markedAt: doc.markedAt.toISOString(),
  }))
}

export async function mealDoneStatus(
  _: unknown,
  args: { date: string; mealType: MealType },
  context: { user?: ContextUser }
): Promise<Record<string, unknown>[]> {
  const user = context.user
  if (!user) return []
  const db = getDb()
  const docs = await db.collection(COLLECTIONS.meal_done).find({
    date: args.date,
    mealType: args.mealType,
  }).toArray() as MealDoneDoc[]
  const userIds = docs.map(d => d.userId)
  const users = await db.collection(COLLECTIONS.users)
    .find({ _id: { $in: userIds } })
    .toArray() as UserDoc[]
  const userMap = new Map(users.map(u => [u._id.toString(), u]))
  return docs.map(doc => ({
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    userName: userMap.get(doc.userId.toString())?.name ?? 'Unknown',
    date: doc.date,
    mealType: doc.mealType,
    markedAt: doc.markedAt.toISOString(),
  }))
}

/**
 * Admin: nudge everyone who ordered a given meal but hasn't marked it eaten yet,
 * asking them to update their eaten status. Returns how many users were notified.
 * Roster = live aggregated selections (opt-outs / deleted users already excluded).
 */
export async function remindNotEaten(
  _: unknown,
  args: { date: string; mealType: MealType },
  context: { user?: ContextUser }
): Promise<number> {
  const user = context.user
  if (!user || user.role !== 'admin') throw new Error('Unauthorized: admin role required')
  const db = getDb()

  const agg = (await aggregatedOrder(_, { date: args.date, mealType: args.mealType })) as {
    items: { personBreakdown: { userId: string }[] }[]
  }
  const roster = new Set<string>()
  for (const it of agg.items) for (const p of it.personBreakdown) roster.add(p.userId)
  if (roster.size === 0) return 0

  const done = (await db
    .collection(COLLECTIONS.meal_done)
    .find({ date: args.date, mealType: args.mealType })
    .toArray()) as MealDoneDoc[]
  const doneSet = new Set(done.map((d) => d.userId.toString()))

  const targets = [...roster].filter((id) => !doneSet.has(id))
  if (targets.length === 0) return 0

  const label = args.mealType.charAt(0).toUpperCase() + args.mealType.slice(1)
  await sendToUsers(
    targets,
    `Update your ${label.toLowerCase()} status 🍔`,
    `Ignore if you haven't eaten your ${label.toLowerCase()} yet.`,
    { type: 'mealDone', date: args.date, mealType: args.mealType },
  )
  return targets.length
}

export async function markMealDone(
  _: unknown,
  args: { date: string; mealType: MealType; done: boolean },
  context: { user?: ContextUser }
): Promise<boolean> {
  const user = context.user
  if (!user) throw new Error('Unauthorized')
  const db = getDb()
  const filter = {
    userId: new ObjectId(user.userId),
    date: args.date,
    mealType: args.mealType,
  }
  if (args.done) {
    await db.collection(COLLECTIONS.meal_done).updateOne(
      filter,
      { $setOnInsert: { ...filter, markedAt: new Date() } },
      { upsert: true }
    )
  } else {
    await db.collection(COLLECTIONS.meal_done).deleteOne(filter)
  }
  return args.done
}
