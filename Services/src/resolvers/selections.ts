import { ObjectId } from 'mongodb'
import { getDb } from '../db.js'
import { COLLECTIONS } from '../constants/collections.js'
import type { ContextUser } from '../types.js'
import type { MealType } from '../types.js'
import type { SelectionDoc, SelectionItemDoc, MenuItemDoc, SettingsDoc } from '../types.js'

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

export async function weeklyExpense(
  _: unknown,
  args: { startDate: string },
  context: { user?: ContextUser }
): Promise<number> {
  const user = context.user
  if (!user || user.role !== 'admin') throw new Error('Unauthorized: admin role required')
  const db = getDb()
  const start = new Date(args.startDate + 'T00:00:00')
  const weekDates: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    weekDates.push(d.toISOString().slice(0, 10))
  }

  const selections = await db.collection(COLLECTIONS.selections).find({
    date: { $in: weekDates },
  }).toArray() as SelectionDoc[]

  const allMenuIds = new Set<string>()
  for (const sel of selections) {
    for (const it of sel.items) allMenuIds.add(it.menuItemId.toString())
  }
  const menuItems = allMenuIds.size > 0
    ? await db.collection(COLLECTIONS.menu_items).find({ _id: { $in: Array.from(allMenuIds).map(id => new ObjectId(id)) } }).toArray() as MenuItemDoc[]
    : []
  const priceMap = new Map(menuItems.map(m => [m._id.toString(), m.pricePerUnit ?? 0]))

  let total = 0
  for (const sel of selections) {
    for (const it of sel.items) {
      total += (priceMap.get(it.menuItemId.toString()) ?? 0) * it.quantity
    }
  }
  return total
}

export async function putSelection(
  _: unknown,
  args: { input: { date: string; mealType: MealType; items: { menuItemId: string; quantity: number }[] } },
  context: { user?: ContextUser }
): Promise<Record<string, unknown>> {
  const user = context.user
  if (!user) throw new Error('Unauthorized: user required for putSelection')
  const db = getDb()

  const settings = await db.collection(COLLECTIONS.settings).findOne({}) as SettingsDoc | null
  const cap = settings?.monthlyMealCap ?? null
  if (cap != null && cap > 0) {
    const inputDate = args.input.date
    const monthPrefix = inputDate.slice(0, 7) // YYYY-MM

    const monthSelections = await db.collection(COLLECTIONS.selections).find({
      userId: new ObjectId(user.userId),
      date: { $regex: `^${monthPrefix}` },
    }).toArray() as SelectionDoc[]

    const allMenuIds = new Set<string>()
    for (const sel of monthSelections) {
      for (const it of sel.items) allMenuIds.add(it.menuItemId.toString())
    }
    for (const it of args.input.items) allMenuIds.add(it.menuItemId)
    const menuItems = allMenuIds.size > 0
      ? await db.collection(COLLECTIONS.menu_items).find({ _id: { $in: Array.from(allMenuIds).map(id => new ObjectId(id)) } }).toArray() as MenuItemDoc[]
      : []
    const priceMap = new Map(menuItems.map(m => [m._id.toString(), m.pricePerUnit ?? 0]))

    let monthlyTotal = 0
    for (const sel of monthSelections) {
      const isSameSlot = sel.date === inputDate && sel.mealType === args.input.mealType
      if (isSameSlot) continue
      for (const it of sel.items) {
        monthlyTotal += (priceMap.get(it.menuItemId.toString()) ?? 0) * it.quantity
      }
    }

    let newSlotCost = 0
    for (const it of args.input.items) {
      newSlotCost += (priceMap.get(it.menuItemId) ?? 0) * it.quantity
    }

    if (monthlyTotal + newSlotCost > cap) {
      throw new Error(`Monthly meal cap exceeded. Your monthly total would be ₹${Math.round(monthlyTotal + newSlotCost)} which exceeds the cap of ₹${Math.round(cap)}.`)
    }
  }

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
