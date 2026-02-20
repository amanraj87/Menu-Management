import { ObjectId } from 'mongodb'
import { getDb } from '../db.js'
import { COLLECTIONS } from '../constants/collections.js'
import type { MealType } from '../types.js'
import type { MenuItemDoc } from '../types.js'

function toMenuItem(doc: MenuItemDoc | null): Record<string, unknown> | null {
  if (!doc) return null
  return {
    id: doc._id.toString(),
    name: doc.name,
    mealType: doc.mealType,
    unit: doc.unit,
    defaultQuantity: doc.defaultQuantity ?? null,
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
  args: { input: { name: string; mealType: MealType; unit: string; defaultQuantity?: number } }
): Promise<Record<string, unknown>> {
  const db = getDb()
  const now = new Date()
  const doc = {
    name: args.input.name,
    mealType: args.input.mealType,
    unit: args.input.unit,
    defaultQuantity: args.input.defaultQuantity,
    createdAt: now,
    updatedAt: now,
  }
  const { insertedId } = await db.collection(COLLECTIONS.menu_items).insertOne(doc)
  const inserted = await db.collection(COLLECTIONS.menu_items).findOne({ _id: insertedId }) as MenuItemDoc
  return toMenuItem(inserted)!
}

export async function updateMenuItem(
  _: unknown,
  args: { id: string; input: { name?: string; unit?: string; defaultQuantity?: number } }
): Promise<Record<string, unknown> | null> {
  const db = getDb()
  if (!ObjectId.isValid(args.id)) return null
  const update: Record<string, unknown> = { updatedAt: new Date() }
  if (args.input.name !== undefined) update.name = args.input.name
  if (args.input.unit !== undefined) update.unit = args.input.unit
  if (args.input.defaultQuantity !== undefined) update.defaultQuantity = args.input.defaultQuantity
  const result = await db.collection(COLLECTIONS.menu_items).findOneAndUpdate(
    { _id: new ObjectId(args.id) },
    { $set: update },
    { returnDocument: 'after' }
  )
  return toMenuItem(result as MenuItemDoc | null)
}

export async function deleteMenuItem(_: unknown, args: { id: string }): Promise<boolean> {
  const db = getDb()
  if (!ObjectId.isValid(args.id)) return false
  const result = await db.collection(COLLECTIONS.menu_items).deleteOne({ _id: new ObjectId(args.id) })
  return result.deletedCount === 1
}
