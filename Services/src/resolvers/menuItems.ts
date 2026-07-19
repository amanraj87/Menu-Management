import { ObjectId } from 'mongodb'
import { getDb } from '../db.js'
import { COLLECTIONS } from '../constants/collections.js'
import { sendToUsers, userIdsByRole } from '../services/fcm.js'
import type { ContextUser } from '../types.js'
import type { MealType } from '../types.js'
import type { MenuItemDoc, PriceHistoryDoc } from '../types.js'

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

  if (args.input.pricePerUnit != null) {
    await db.collection(COLLECTIONS.price_history).insertOne({
      menuItemId: insertedId,
      menuItemName: args.input.name,
      oldPrice: null,
      newPrice: args.input.pricePerUnit,
      changedAt: now,
    })
  }

  const admins = await userIdsByRole('admin')
  await sendToUsers(
    admins,
    'New menu item added',
    `${args.input.name} (${args.input.mealType}) — ₹${args.input.pricePerUnit ?? 0}/${args.input.unit}`,
    { type: 'menuAdd', menuItemId: insertedId.toString() },
  )

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

  if (updated) {
    const priceChanged =
      args.input.pricePerUnit !== undefined &&
      existing?.pricePerUnit !== updated.pricePerUnit

    if (priceChanged) {
      await db.collection(COLLECTIONS.price_history).insertOne({
        menuItemId: _id,
        menuItemName: updated.name,
        oldPrice: existing?.pricePerUnit ?? null,
        newPrice: updated.pricePerUnit ?? null,
        changedAt: new Date(),
      })
    }

    const admins = await userIdsByRole('admin')
    if (priceChanged) {
      await sendToUsers(
        admins,
        'Vendor changed a meal price',
        `${updated.name} is now ₹${updated.pricePerUnit}`,
        { type: 'menuPrice', menuItemId: args.id },
      )
    } else {
      const changes: string[] = []
      if (args.input.name !== undefined && args.input.name !== existing?.name)
        changes.push(`name → ${args.input.name}`)
      if (args.input.unit !== undefined && args.input.unit !== existing?.unit)
        changes.push(`unit → ${args.input.unit}`)
      if (args.input.mealType !== undefined && args.input.mealType !== existing?.mealType)
        changes.push(`meal → ${args.input.mealType}`)
      if (changes.length > 0) {
        await sendToUsers(
          admins,
          'Vendor updated a menu item',
          `${updated.name}: ${changes.join(', ')}`,
          { type: 'menuUpdate', menuItemId: args.id },
        )
      }
    }
  }

  return toMenuItem(updated)
}

export async function priceHistory(
  _: unknown,
  args: { menuItemId?: string },
): Promise<Record<string, unknown>[]> {
  const db = getDb()
  const filter: Record<string, unknown> = {}
  if (args.menuItemId) {
    if (!ObjectId.isValid(args.menuItemId)) return []
    filter.menuItemId = new ObjectId(args.menuItemId)
  }
  const docs = (await db
    .collection(COLLECTIONS.price_history)
    .find(filter)
    .sort({ changedAt: -1 })
    .limit(200)
    .toArray()) as PriceHistoryDoc[]
  return docs.map((d) => ({
    id: d._id.toString(),
    menuItemId: d.menuItemId.toString(),
    menuItemName: d.menuItemName,
    oldPrice: d.oldPrice,
    newPrice: d.newPrice,
    changedAt: d.changedAt.toISOString(),
  }))
}

export async function deleteMenuItem(_: unknown, args: { id: string }, context: { user?: ContextUser }): Promise<boolean> {
  if (!context.user || context.user.role !== 'vendor') throw new Error('Only vendor can remove menu items')
  const db = getDb()
  if (!ObjectId.isValid(args.id)) return false
  const existing = await db.collection(COLLECTIONS.menu_items).findOne({ _id: new ObjectId(args.id) }) as MenuItemDoc | null
  const result = await db.collection(COLLECTIONS.menu_items).deleteOne({ _id: new ObjectId(args.id) })
  if (result.deletedCount === 1 && existing) {
    const admins = await userIdsByRole('admin')
    await sendToUsers(
      admins,
      'Menu item removed',
      `${existing.name} (${existing.mealType}) was removed by vendor`,
      { type: 'menuDelete' },
    )
  }
  return result.deletedCount === 1
}
