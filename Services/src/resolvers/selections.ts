import { ObjectId } from 'mongodb'
import { getDb } from '../db.js'
import { COLLECTIONS } from '../constants/collections.js'
import type { ContextUser } from '../types.js'
import type { MealType } from '../types.js'
import type { SelectionDoc, SelectionItemDoc } from '../types.js'

function toSelection(doc: SelectionDoc | null): Record<string, unknown> | null {
  if (!doc) return null
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    date: doc.date,
    mealType: doc.mealType,
    items: doc.items.map((i) => ({ menuItemId: i.menuItemId.toString(), quantity: i.quantity })),
    updatedAt: doc.updatedAt?.toISOString() ?? null,
  }
}

export async function mySelection(
  _: unknown,
  args: { date: string; mealType: MealType },
  context: { user?: ContextUser }
): Promise<Record<string, unknown> | null> {
  const user = context.user
  if (!user) return null
  const db = getDb()
  const doc = await db.collection(COLLECTIONS.selections).findOne({
    userId: new ObjectId(user.userId),
    date: args.date,
    mealType: args.mealType,
  }) as SelectionDoc | null
  return toSelection(doc)
}

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner']

export async function mySelectionsForWeek(
  _: unknown,
  args: { startDate: string },
  context: { user?: ContextUser }
): Promise<Record<string, unknown>[]> {
  const user = context.user
  if (!user) return []
  const db = getDb()
  const results: Record<string, unknown>[] = []
  const start = new Date(args.startDate + 'T00:00:00')
  for (let d = 0; d < 7; d++) {
    const date = new Date(start)
    date.setDate(start.getDate() + d)
    const dateStr = date.toISOString().slice(0, 10)
    for (const mealType of MEAL_TYPES) {
      const doc = await db.collection(COLLECTIONS.selections).findOne({
        userId: new ObjectId(user.userId),
        date: dateStr,
        mealType,
      }) as SelectionDoc | null
      results.push(toSelection(doc) ?? { id: `${dateStr}-${mealType}`, userId: user.userId, date: dateStr, mealType, items: [], updatedAt: null })
    }
  }
  return results
}

export async function putSelection(
  _: unknown,
  args: { input: { date: string; mealType: MealType; items: { menuItemId: string; quantity: number }[] } },
  context: { user?: ContextUser }
): Promise<Record<string, unknown>> {
  const user = context.user
  if (!user) throw new Error('Unauthorized: user required for putSelection')
  const db = getDb()
  const items: SelectionItemDoc[] = args.input.items.map((i) => ({
    menuItemId: new ObjectId(i.menuItemId),
    quantity: i.quantity,
  }))
  const now = new Date()
  const filter = {
    userId: new ObjectId(user.userId),
    date: args.input.date,
    mealType: args.input.mealType,
  }
  const update = { $set: { items, updatedAt: now } }
  const result = await db.collection(COLLECTIONS.selections).findOneAndUpdate(
    filter,
    update,
    { returnDocument: 'after', upsert: true }
  )
  return toSelection(result as SelectionDoc)!
}
