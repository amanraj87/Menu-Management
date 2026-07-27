import { ObjectId } from 'mongodb'
import { getDb } from '../db.js'
import { COLLECTIONS } from '../constants/collections.js'
import { sendToUsers, userIdsByRole } from '../services/fcm.js'
import type { ContextUser, MealType, MealOptOutDoc, UserDoc } from '../types.js'

export async function myMealOptOuts(
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
  const docs = await db.collection(COLLECTIONS.meal_opt_outs).find({
    userId: new ObjectId(user.userId),
    date: { $in: dates },
  }).toArray() as MealOptOutDoc[]
  return docs.map(doc => ({
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    date: doc.date,
    mealType: doc.mealType,
  }))
}

export async function toggleMealOptOut(
  _: unknown,
  args: { date: string; mealType: MealType; optedOut: boolean },
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
  if (args.optedOut) {
    await db.collection(COLLECTIONS.meal_opt_outs).updateOne(
      filter,
      { $setOnInsert: { ...filter, createdAt: new Date() } },
      { upsert: true }
    )

    // Notify admins that a person has skipped (toggled off) an upcoming meal.
    // Only on opt-out (not on re-enabling); best-effort, never blocks the toggle.
    const person = (await db
      .collection(COLLECTIONS.users)
      .findOne({ _id: new ObjectId(user.userId) })) as UserDoc | null
    const name = person?.name ?? 'Someone'
    const meal = args.mealType.charAt(0).toUpperCase() + args.mealType.slice(1)
    const admins = await userIdsByRole('admin')
    await sendToUsers(
      admins,
      'A meal was skipped',
      `${name} skipped ${meal} on ${args.date}`,
      { type: 'mealOptOut', date: args.date, mealType: args.mealType },
    )
  } else {
    await db.collection(COLLECTIONS.meal_opt_outs).deleteOne(filter)
  }
  return args.optedOut
}
