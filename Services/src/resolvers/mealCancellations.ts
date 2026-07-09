import { ObjectId } from 'mongodb'
import { getDb } from '../db.js'
import { COLLECTIONS } from '../constants/collections.js'
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
  if (!user || (user.role !== 'vendor' && user.role !== 'admin')) {
    throw new Error('Unauthorized: vendor or admin role required')
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
  return args.cancelled
}
