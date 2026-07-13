import { ObjectId } from 'mongodb'
import { getDb } from '../db.js'
import { COLLECTIONS } from '../constants/collections.js'
import { sendToUsers, userIdsByRole } from '../services/fcm.js'
import type { ContextUser } from '../types.js'
import type { MealType } from '../types.js'
import type { MenuItemDoc } from '../types.js'

function toMenuItem(doc: MenuItemDoc | null): Record<string, unknown> | null {
  if (!doc) return null
  return {
    id: doc._id.toString(),
    name: doc.name,
    mealType: doc.mealType,
    unit: doc.unit,
    pricePerUnit: doc.pricePerUnit ?? null,
    createdAt: doc.createdAt?.toISOString() ?? null,
    updatedAt: doc.updatedAt?.toISOString() ?? null,
  }
}

export async function menuItems(_: unknown, args: { mealType?: MealType }): Promise<Record<string, unknown>[]> {
  const db = getDb()
  const filter = args.mealType ? { mealType: args.mealType } : {}
  const cursor = db.collection(COLLECTIONS.menu_items).find(filter)
  const docs = await cursor.toArray() as MenuItemDoc[]
  return docs.map((d) => toMenuItem(d)!)
}

export async function menuItem(_: unknown, args: { id: string }): Promise<Record<string, unknown> | null> {
  const db = getDb()
  if (!ObjectId.isValid(args.id)) return null
  const doc = await db.collection(COLLECTIONS.menu_items).findOne({ _id: new ObjectId(args.id) }) as MenuItemDoc | null
  return toMenuItem(doc)
}

export async function createMenuItem(
  _: unknown,
  args: { input: { name: string; mealType: MealType; unit: string; pricePerUnit?: number } },
  context: { user?: ContextUser }
): Promise<Record<string, unknown>> {
  if (!context.user || context.user.role !== 'vendor') throw new Error('Only vendor can add or edit menu items')
  const db = getDb()
  const now = new Date()
  const doc = {
    name: args.input.name,
    mealType: args.input.mealType,
    unit: args.input.unit,
    pricePerUnit: args.input.pricePerUnit,
    createdAt: now,
    updatedAt: now,
  }
  const { insertedId } = await db.collection(COLLECTIONS.menu_items).insertOne(doc)
  const inserted = await db.collection(COLLECTIONS.menu_items).findOne({ _id: insertedId }) as MenuItemDoc
  return toMenuItem(inserted)!
}

export async function updateMenuItem(
  _: unknown,
  args: { id: string; input: { name?: string; mealType?: MealType; unit?: string; pricePerUnit?: number } },
  context: { user?: ContextUser }
): Promise<Record<string, unknown> | null> {
  if (!context.user || context.user.role !== 'vendor') throw new Error('Only vendor can add or edit menu items')
  const db = getDb()
  if (!ObjectId.isValid(args.id)) return null
  const _id = new ObjectId(args.id)
  const existing = (await db
    .collection(COLLECTIONS.menu_items)
    .findOne({ _id })) as MenuItemDoc | null
  const update: Record<string, unknown> = { updatedAt: new Date() }
  if (args.input.name !== undefined) update.name = args.input.name
  if (args.input.mealType !== undefined) update.mealType = args.input.mealType
  if (args.input.unit !== undefined) update.unit = args.input.unit
  if (args.input.pricePerUnit !== undefined) update.pricePerUnit = args.input.pricePerUnit
  const result = await db.collection(COLLECTIONS.menu_items).findOneAndUpdate(
    { _id },
    { $set: update },
    { returnDocument: 'after' }
  )
  const updated = result as MenuItemDoc | null

  // A2: notify admins only when the price actually changed (not on name/unit edits).
  if (
    updated &&
    args.input.pricePerUnit !== undefined &&
    existing?.pricePerUnit !== updated.pricePerUnit
  ) {
    const admins = await userIdsByRole('admin')
    await sendToUsers(
      admins,
      'Vendor changed a meal price',
      `${updated.name} is now ₹${updated.pricePerUnit}`,
      { type: 'menuPrice', menuItemId: args.id },
    )
  }

  return toMenuItem(updated)
}

export async function deleteMenuItem(_: unknown, args: { id: string }, context: { user?: ContextUser }): Promise<boolean> {
  if (!context.user || context.user.role !== 'vendor') throw new Error('Only vendor can remove menu items')
  const db = getDb()
  if (!ObjectId.isValid(args.id)) return false
  const result = await db.collection(COLLECTIONS.menu_items).deleteOne({ _id: new ObjectId(args.id) })
  return result.deletedCount === 1
}
