import { ObjectId } from 'mongodb'
import { getDb } from '../db.js'
import { COLLECTIONS } from '../constants/collections.js'
import { sendToUsers, userIdsByRole } from '../services/fcm.js'
import type { ContextUser } from '../types.js'
import type { MealType } from '../types.js'
import type {
  MenuItemDoc,
  SelectionDoc,
  MealOptOutDoc,
  ConfirmedOrderDoc,
  ConfirmedOrderItemDoc,
  PersonBreakdownDoc,
  UserDoc,
} from '../types.js'

export async function aggregatedOrder(
  _: unknown,
  args: { date: string; mealType: MealType }
): Promise<Record<string, unknown>> {
  const db = getDb()

  const optOuts = await db
    .collection(COLLECTIONS.meal_opt_outs)
    .find({ date: args.date, mealType: args.mealType })
    .toArray() as MealOptOutDoc[]
  const optedOutUserIds = new Set(optOuts.map(o => o.userId.toString()))

  const allSelections = await db
    .collection(COLLECTIONS.selections)
    .find({ date: args.date, mealType: args.mealType })
    .toArray() as SelectionDoc[]

  // Only count selections from users that still exist (drop deleted/orphan users)
  // and who haven't opted out.
  const candidateUserIds = new Set(allSelections.map((s) => s.userId.toString()))
  const users = candidateUserIds.size > 0
    ? await db.collection(COLLECTIONS.users)
        .find({ _id: { $in: Array.from(candidateUserIds).map((id) => new ObjectId(id)) } })
        .toArray() as UserDoc[]
    : []
  const userMap = new Map(users.map((u) => [u._id.toString(), u]))

  const selections = allSelections.filter(
    (s) => userMap.has(s.userId.toString()) && !optedOutUserIds.has(s.userId.toString())
  )

  const menuItemIds = new Set<string>()
  for (const s of selections) {
    for (const i of s.items) menuItemIds.add(i.menuItemId.toString())
  }
  if (menuItemIds.size === 0) {
    return { date: args.date, mealType: args.mealType, items: [] }
  }

  const menuItems = await db
    .collection(COLLECTIONS.menu_items)
    .find({ _id: { $in: Array.from(menuItemIds).map((id) => new ObjectId(id)) } })
    .toArray() as MenuItemDoc[]
  const menuMap = new Map(menuItems.map((m) => [m._id.toString(), m]))

  const byItem = new Map<string, { total: number; byUser: Map<string, number> }>()
  for (const sel of selections) {
    const uid = sel.userId.toString()
    for (const i of sel.items) {
      const key = i.menuItemId.toString()
      if (!byItem.has(key)) byItem.set(key, { total: 0, byUser: new Map() })
      const entry = byItem.get(key)!
      entry.total += i.quantity
      entry.byUser.set(uid, (entry.byUser.get(uid) ?? 0) + i.quantity)
    }
  }

  const items: Record<string, unknown>[] = []
  for (const [menuItemId, entry] of byItem) {
    const menu = menuMap.get(menuItemId)
    if (!menu) continue
    const personBreakdown = Array.from(entry.byUser.entries()).map(([uid, quantity]) => ({
      userId: uid,
      userName: userMap.get(uid)?.name ?? 'Unknown',
      quantity,
    }))
    items.push({
      menuItemId,
      name: menu.name,
      unit: menu.unit,
      quantity: entry.total,
      personBreakdown,
    })
  }

  return { date: args.date, mealType: args.mealType, items }
}

export async function aggregatedOrdersForRange(
  _: unknown,
  args: { startDate: string; endDate: string }
): Promise<Record<string, unknown>[]> {
  const db = getDb()

  const optOuts = await db
    .collection(COLLECTIONS.meal_opt_outs)
    .find({ date: { $gte: args.startDate, $lte: args.endDate } })
    .toArray() as MealOptOutDoc[]
  const optedOut = new Set(optOuts.map(o => `${o.date}|${o.mealType}|${o.userId.toString()}`))

  const allSelections = await db
    .collection(COLLECTIONS.selections)
    .find({ date: { $gte: args.startDate, $lte: args.endDate } })
    .toArray() as SelectionDoc[]

  // Only count selections from users that still exist (drop deleted/orphan users)
  // and who haven't opted out.
  const candidateUserIds = new Set(allSelections.map(s => s.userId.toString()))
  const users = candidateUserIds.size > 0
    ? await db.collection(COLLECTIONS.users)
        .find({ _id: { $in: Array.from(candidateUserIds).map(id => new ObjectId(id)) } })
        .toArray() as UserDoc[]
    : []
  const userMap = new Map(users.map(u => [u._id.toString(), u]))

  const selections = allSelections.filter(
    s => userMap.has(s.userId.toString()) && !optedOut.has(`${s.date}|${s.mealType}|${s.userId.toString()}`)
  )
  if (selections.length === 0) return []

  const menuItemIds = new Set<string>()
  for (const s of selections) {
    for (const i of s.items) menuItemIds.add(i.menuItemId.toString())
  }

  const menuItems = await db
    .collection(COLLECTIONS.menu_items)
    .find({ _id: { $in: Array.from(menuItemIds).map(id => new ObjectId(id)) } })
    .toArray() as MenuItemDoc[]
  const menuMap = new Map(menuItems.map(m => [m._id.toString(), m]))

  // Group selections by date+mealType, then aggregate per menu item.
  const byCombo = new Map<string, { date: string; mealType: MealType; byItem: Map<string, { total: number; byUser: Map<string, number> }> }>()
  for (const sel of selections) {
    const comboKey = `${sel.date}|${sel.mealType}`
    if (!byCombo.has(comboKey)) byCombo.set(comboKey, { date: sel.date, mealType: sel.mealType, byItem: new Map() })
    const combo = byCombo.get(comboKey)!
    const uid = sel.userId.toString()
    for (const i of sel.items) {
      const key = i.menuItemId.toString()
      if (!combo.byItem.has(key)) combo.byItem.set(key, { total: 0, byUser: new Map() })
      const entry = combo.byItem.get(key)!
      entry.total += i.quantity
      entry.byUser.set(uid, (entry.byUser.get(uid) ?? 0) + i.quantity)
    }
  }

  const result: Record<string, unknown>[] = []
  for (const combo of byCombo.values()) {
    const items: Record<string, unknown>[] = []
    for (const [menuItemId, entry] of combo.byItem) {
      const menu = menuMap.get(menuItemId)
      if (!menu) continue
      const personBreakdown = Array.from(entry.byUser.entries()).map(([uid, quantity]) => ({
        userId: uid,
        userName: userMap.get(uid)?.name ?? 'Unknown',
        quantity,
      }))
      items.push({ menuItemId, name: menu.name, unit: menu.unit, quantity: entry.total, personBreakdown })
    }
    if (items.length > 0) result.push({ date: combo.date, mealType: combo.mealType, items })
  }
  return result
}

export async function confirmOrder(
  _: unknown,
  args: { date: string; mealType: MealType },
  context: { user?: ContextUser }
): Promise<Record<string, unknown>> {
  const user = context.user
  if (!user || user.role !== 'admin') throw new Error('Unauthorized: admin role required to confirm order')

  const db = getDb()
  const agg = await aggregatedOrder(_, args) as { date: string; mealType: MealType; items: { menuItemId: string; name: string; unit: string; quantity: number; personBreakdown: { userId: string; userName: string; quantity: number }[] }[] }
  const orderItems: ConfirmedOrderItemDoc[] = agg.items.map((i) => ({
    menuItemId: new ObjectId(i.menuItemId),
    name: i.name,
    unit: i.unit,
    quantity: i.quantity,
    personBreakdown: i.personBreakdown.map((p) => ({
      userId: new ObjectId(p.userId),
      userName: p.userName,
      quantity: p.quantity,
    })) as PersonBreakdownDoc[],
  }))

  const doc: Omit<ConfirmedOrderDoc, '_id'> = {
    date: args.date,
    mealType: args.mealType as MealType,
    items: orderItems,
    confirmedBy: new ObjectId(user.userId),
    confirmedAt: new Date(),
  }
  const result = await db.collection(COLLECTIONS.confirmed_orders).findOneAndUpdate(
    { date: args.date, mealType: args.mealType },
    { $set: doc },
    { returnDocument: 'after', upsert: true }
  ) as ConfirmedOrderDoc | null
  if (!result) throw new Error('Failed to save confirmed order')

  return {
    id: result._id.toString(),
    date: result.date,
    mealType: result.mealType,
    items: result.items.map((i) => ({
      menuItemId: i.menuItemId.toString(),
      name: i.name,
      unit: i.unit,
      quantity: i.quantity,
      personBreakdown: i.personBreakdown.map((p) => ({
        userId: p.userId.toString(),
        userName: p.userName,
        quantity: p.quantity,
      })),
    })),
    confirmedBy: result.confirmedBy.toString(),
    confirmedAt: result.confirmedAt.toISOString(),
  }
}

export async function confirmOrderWithItems(
  _: unknown,
  args: {
    date: string
    mealType: MealType
    items: { menuItemId: string; name: string; unit: string; quantity: number }[]
  },
  context: { user?: ContextUser }
): Promise<Record<string, unknown>> {
  const user = context.user
  if (!user || user.role !== 'admin') throw new Error('Unauthorized: admin role required to confirm order')

  for (const i of args.items) {
    if (!Number.isFinite(i.quantity) || i.quantity <= 0) {
      throw new Error(`Invalid quantity ${i.quantity} for "${i.name}": must be a positive number`)
    }
  }

  const db = getDb()

  // Preserve per-person breakdowns: prefer the live aggregated selections,
  // fall back to the breakdown already stored on the existing confirmed order.
  const agg = await aggregatedOrder(_, { date: args.date, mealType: args.mealType }) as {
    items: { menuItemId: string; quantity: number; personBreakdown: { userId: string; userName: string; quantity: number }[] }[]
  }
  const aggBreakdowns = new Map(agg.items.map((i) => [i.menuItemId, i.personBreakdown]))
  const existingDoc = await db.collection(COLLECTIONS.confirmed_orders).findOne(
    { date: args.date, mealType: args.mealType }
  ) as ConfirmedOrderDoc | null
  const existingBreakdowns = new Map(
    (existingDoc?.items ?? []).map((i) => [i.menuItemId.toString(), i.personBreakdown])
  )

  const orderItems: ConfirmedOrderItemDoc[] = args.items.map((i) => {
    const aggBd = aggBreakdowns.get(i.menuItemId)
    const personBreakdown: PersonBreakdownDoc[] = aggBd
      ? aggBd.map((p) => ({ userId: new ObjectId(p.userId), userName: p.userName, quantity: p.quantity }))
      : (existingBreakdowns.get(i.menuItemId) ?? [])
    return {
      menuItemId: new ObjectId(i.menuItemId),
      name: i.name,
      unit: i.unit,
      quantity: i.quantity,
      personBreakdown,
    }
  })

  const doc: Omit<ConfirmedOrderDoc, '_id'> = {
    date: args.date,
    mealType: args.mealType as MealType,
    items: orderItems,
    confirmedBy: new ObjectId(user.userId),
    confirmedAt: new Date(),
  }
  const result = await db.collection(COLLECTIONS.confirmed_orders).findOneAndUpdate(
    { date: args.date, mealType: args.mealType },
    { $set: doc },
    { returnDocument: 'after', upsert: true }
  ) as ConfirmedOrderDoc | null
  if (!result) throw new Error('Failed to save confirmed order')

  return {
    id: result._id.toString(),
    date: result.date,
    mealType: result.mealType,
    items: result.items.map((i) => ({
      menuItemId: i.menuItemId.toString(),
      name: i.name,
      unit: i.unit,
      quantity: i.quantity,
      personBreakdown: i.personBreakdown.map((p) => ({
        userId: p.userId.toString(),
        userName: p.userName,
        quantity: p.quantity,
      })),
    })),
    confirmedBy: result.confirmedBy.toString(),
    confirmedAt: result.confirmedAt.toISOString(),
  }
}

function toConfirmedOrder(doc: ConfirmedOrderDoc): Record<string, unknown> {
  return {
    id: doc._id.toString(),
    date: doc.date,
    mealType: doc.mealType,
    items: doc.items.map((i) => ({
      menuItemId: i.menuItemId.toString(),
      name: i.name,
      unit: i.unit,
      quantity: i.quantity,
      personBreakdown: i.personBreakdown.map((p) => ({
        userId: p.userId.toString(),
        userName: p.userName,
        quantity: p.quantity,
      })),
    })),
    confirmedBy: doc.confirmedBy.toString(),
    confirmedAt: doc.confirmedAt.toISOString(),
  }
}

export async function confirmedOrders(
  _: unknown,
  args: { date: string }
): Promise<Record<string, unknown>[]> {
  const db = getDb()
  const orders = await db
    .collection(COLLECTIONS.confirmed_orders)
    .find({ date: args.date })
    .toArray() as ConfirmedOrderDoc[]
  return orders.map(toConfirmedOrder)
}

/**
 * Admin: send a single "orders are ready" push to all vendors after a
 * Send-to-Shefs run. Called once by the client after it finishes confirming the
 * week's meals, so the vendor gets one notification instead of one per meal.
 */
export async function notifyOrdersSentToVendor(
  _: unknown,
  args: { startDate: string; endDate: string },
  context: { user?: ContextUser }
): Promise<number> {
  const user = context.user
  if (!user || user.role !== 'admin') throw new Error('Unauthorized: admin role required')
  const vendors = await userIdsByRole('vendor')
  if (vendors.length === 0) return 0
  const range = args.startDate === args.endDate ? args.startDate : `${args.startDate} – ${args.endDate}`
  await sendToUsers(
    vendors,
    'Orders updated',
    `Orders for ${range} have been updated. Open the week to view them.`,
    { type: 'ordersSent' },
  )
  return vendors.length
}

export async function confirmedOrdersForRange(
  _: unknown,
  args: { startDate: string; endDate: string }
): Promise<Record<string, unknown>[]> {
  const db = getDb()
  const orders = await db
    .collection(COLLECTIONS.confirmed_orders)
    .find({ date: { $gte: args.startDate, $lte: args.endDate } })
    .toArray() as ConfirmedOrderDoc[]
  return orders.map(toConfirmedOrder)
}
