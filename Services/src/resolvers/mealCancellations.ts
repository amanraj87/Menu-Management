import { ObjectId } from 'mongodb'
import { getDb } from '../db.js'
import { COLLECTIONS } from '../constants/collections.js'
import { aggregatedOrder } from './orders.js'
import { sendToUsers, userIdsByRole } from '../services/fcm.js'
import type { ContextUser, MealType, MealCancellationDoc } from '../types.js'

export async function mealCancellationsForRange(
  _: unknown,
  args: { startDate: string; endDate: string },
  context: { user?: ContextUser }
): Promise<Record<string, unknown>[]> {
  const user = context.user
  if (!user) return []
  const db = getDb()
  const docs = await db.collection(COLLECTIONS.meal_cancellations).find({
    date: { $gte: args.startDate, $lte: args.endDate },
  }).toArray() as MealCancellationDoc[]
  return docs.map(doc => ({
    id: doc._id.toString(),
    date: doc.date,
    mealType: doc.mealType,
  }))
}

export async function toggleMealCancellation(
  _: unknown,
  args: { date: string; mealType: MealType; cancelled: boolean },
  context: { user?: ContextUser }
): Promise<boolean> {
  const user = context.user
  if (!user || user.role !== 'admin') {
    throw new Error('Unauthorized: admin role required')
  }
  const db = getDb()
  const filter = { date: args.date, mealType: args.mealType }
  if (args.cancelled) {
    await db.collection(COLLECTIONS.meal_cancellations).updateOne(
      filter,
      { $setOnInsert: { ...filter, cancelledBy: new ObjectId(user.userId), cancelledAt: new Date() } },
      { upsert: true }
    )
  } else {
    await db.collection(COLLECTIONS.meal_cancellations).deleteOne(filter)
  }

  // Cancellation is admin-only, so notify the vendor and everyone who ordered
  // this meal that it was cancelled (kitchen closed) or restored.
  const agg = (await aggregatedOrder(_, { date: args.date, mealType: args.mealType })) as {
    items: { personBreakdown: { userId: string }[] }[]
  }
  const targets = new Set<string>()
  for (const v of await userIdsByRole('vendor')) targets.add(v.toString())
  for (const it of agg.items) for (const p of it.personBreakdown) targets.add(p.userId)
  if (targets.size > 0) {
    const label = args.mealType.charAt(0).toUpperCase() + args.mealType.slice(1)
    const title = args.cancelled ? `${label} cancelled` : `${label} is back on`
    const body = args.cancelled
      ? `${label} on ${args.date} has been cancelled — kitchen closed.`
      : `${label} on ${args.date} has been restored.`
    await sendToUsers([...targets], title, body, {
      type: 'mealCancelled',
      date: args.date,
      mealType: args.mealType,
    })
  }

  return args.cancelled
}
