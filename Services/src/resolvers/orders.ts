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
  OrderChangeDoc,
  OrderRevisionDoc,
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

/** Today's date (UTC) as YYYY-MM-DD. */
function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

type NewItem = { menuItemId: string; name: string; unit: string; quantity: number }

/**
 * Item-level difference between the order the vendor already has and the one
 * replacing it. Returns [] when nothing meaningful changed.
 */
function diffOrderItems(
  oldItems: ConfirmedOrderItemDoc[],
  newItems: NewItem[],
): OrderChangeDoc[] {
  const oldById = new Map(oldItems.map((i) => [i.menuItemId.toString(), i]))
  const newById = new Map(newItems.map((i) => [i.menuItemId, i]))
  const changes: OrderChangeDoc[] = []

  for (const n of newItems) {
    const prev = oldById.get(n.menuItemId)
    if (!prev) {
      changes.push({
        menuItemId: new ObjectId(n.menuItemId),
        name: n.name,
        unit: n.unit,
        kind: 'added',
        oldQuantity: null,
        newQuantity: n.quantity,
      })
    } else if (prev.quantity !== n.quantity) {
      changes.push({
        menuItemId: new ObjectId(n.menuItemId),
        name: n.name,
        unit: n.unit,
        kind: 'changed',
        oldQuantity: prev.quantity,
        newQuantity: n.quantity,
      })
    }
  }
  for (const o of oldItems) {
    if (!newById.has(o.menuItemId.toString())) {
      changes.push({
        menuItemId: o.menuItemId,
        name: o.name,
        unit: o.unit,
        kind: 'removed',
        oldQuantity: o.quantity,
        newQuantity: null,
      })
    }
  }
  return changes
}

/**
 * Record what changed about an already-sent order. No-op on a first-ever send:
 * a brand-new week is entirely "added", which is noise rather than a change the
 * vendor needs flagged.
 */
async function recordOrderRevision(
  date: string,
  mealType: MealType,
  existing: ConfirmedOrderDoc | null,
  newItems: NewItem[],
  changedBy: string,
): Promise<OrderChangeDoc[]> {
  if (!existing) return []
  const changes = diffOrderItems(existing.items ?? [], newItems)
  if (changes.length === 0) return []
  await getDb().collection(COLLECTIONS.order_revisions).insertOne({
    date,
    mealType,
    changes,
    changedBy: new ObjectId(changedBy),
    changedAt: new Date(),
  })
  return changes
}

/** Compact human summary of a diff, e.g. "Pulka 4→6, +Kadai Chicken, −Curd". */
export function summariseChanges(changes: OrderChangeDoc[], max = 3): string {
  const parts = changes.map((c) => {
    if (c.kind === 'added') return `+${c.name}`
    if (c.kind === 'removed') return `−${c.name}`
    return `${c.name} ${c.oldQuantity}→${c.newQuantity}`
  })
  if (parts.length <= max) return parts.join(', ')
  return `${parts.slice(0, max).join(', ')} +${parts.length - max} more`
}

/**
 * Refuse to rewrite a day that has already been delivered.
 *
 * A user can cancel an upcoming meal that the admin never forwards; once that
 * day passes, the vendor has already cooked the original order. Re-sending the
 * week later would overwrite that snapshot with the reduced live figure, which
 * both loses the record of what was supplied and *understates* Vendor dues
 * (dues is computed from confirmed_orders).
 *
 * A past day with nothing confirmed yet is still allowed through: there is no
 * snapshot to destroy, and recording it makes dues correct for a week that was
 * never sent.
 *
 * Note: "past" is judged in UTC while clients judge it locally. For timezones
 * ahead of UTC (e.g. IST) the server's past is a subset of the client's, so this
 * never blocks a send the client considers legitimate — the client-side skip is
 * the primary guard and this is the backstop.
 */
async function assertNotRewritingDeliveredDay(date: string, mealType: MealType): Promise<void> {
  if (date >= todayUTC()) return
  const existing = await getDb()
    .collection(COLLECTIONS.confirmed_orders)
    .findOne({ date, mealType })
  if (existing) {
    throw new Error(
      `${date} has already passed and its ${mealType} was already sent to the vendor, so it can't be changed. Use the vendor's final amount to correct a delivered day.`
    )
  }
}

export async function confirmOrder(
  _: unknown,
  args: { date: string; mealType: MealType },
  context: { user?: ContextUser }
): Promise<Record<string, unknown>> {
  const user = context.user
  if (!user || user.role !== 'admin') throw new Error('Unauthorized: admin role required to confirm order')
  await assertNotRewritingDeliveredDay(args.date, args.mealType)

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

  // Read the version the vendor currently has so the change can be logged.
  const existingForRevision = await db.collection(COLLECTIONS.confirmed_orders).findOne(
    { date: args.date, mealType: args.mealType }
  ) as ConfirmedOrderDoc | null

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

  await recordOrderRevision(
    args.date,
    args.mealType,
    existingForRevision,
    agg.items.map((i) => ({ menuItemId: i.menuItemId, name: i.name, unit: i.unit, quantity: i.quantity })),
    user.userId,
  )

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
  await assertNotRewritingDeliveredDay(args.date, args.mealType)

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

  await recordOrderRevision(args.date, args.mealType, existingDoc, args.items, user.userId)

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
 * Admin: re-send ONE meal to the vendor and notify them, in a single call.
 *
 * Exists so the "Send to vendor" button on the meal-skipped notification can act
 * without opening the app: it re-confirms straight from the live aggregate
 * (server-side, so no client data is needed) and then pushes the vendor.
 * Returns the number of items sent.
 */
export async function resendMealToVendor(
  _: unknown,
  args: { date: string; mealType: MealType },
  context: { user?: ContextUser }
): Promise<number> {
  const user = context.user
  if (!user || user.role !== 'admin') throw new Error('Unauthorized: admin role required')

  // confirmOrder recomputes from aggregatedOrder, which already excludes
  // opt-outs — so this picks up the cancellation that triggered the alert.
  const confirmed = (await confirmOrder(_, args, context)) as { items: unknown[] }
  const itemCount = confirmed.items.length

  const label = args.mealType.charAt(0).toUpperCase() + args.mealType.slice(1)
  const vendors = await userIdsByRole('vendor')
  if (vendors.length > 0) {
    // Tell the vendor exactly what moved — confirmOrder just logged the diff.
    const latest = (await getDb()
      .collection(COLLECTIONS.order_revisions)
      .find({ date: args.date, mealType: args.mealType })
      .sort({ changedAt: -1 })
      .limit(1)
      .next()) as OrderRevisionDoc | null
    const summary = latest ? summariseChanges(latest.changes) : ''
    await sendToUsers(
      vendors,
      `${label} updated for ${args.date}`,
      summary || `${label} orders for ${args.date} have been updated. Open the week to view them.`,
      { type: 'ordersSent', date: args.date, mealType: args.mealType },
    )
  }
  return itemCount
}

/** Vendor/admin: item-level order changes in a date range, newest first. */
export async function orderRevisionsForRange(
  _: unknown,
  args: { startDate: string; endDate: string },
  context: { user?: ContextUser }
): Promise<Record<string, unknown>[]> {
  const user = context.user
  if (!user || (user.role !== 'vendor' && user.role !== 'admin')) {
    throw new Error('Unauthorized: vendor or admin role required')
  }
  const docs = (await getDb()
    .collection(COLLECTIONS.order_revisions)
    .find({ date: { $gte: args.startDate, $lte: args.endDate } })
    .sort({ changedAt: -1 })
    .limit(500)
    .toArray()) as OrderRevisionDoc[]
  return docs.map((d) => ({
    id: d._id.toString(),
    date: d.date,
    mealType: d.mealType,
    changedAt: d.changedAt.toISOString(),
    changes: d.changes.map((c) => ({
      menuItemId: c.menuItemId.toString(),
      name: c.name,
      unit: c.unit,
      kind: c.kind,
      oldQuantity: c.oldQuantity,
      newQuantity: c.newQuantity,
    })),
  }))
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

  // Summarise what this send actually changed. The window covers the confirm
  // loop that just ran (a send takes seconds); worst case it also mentions a
  // change from a few minutes earlier, which the vendor wants to know anyway.
  const since = new Date(Date.now() - 10 * 60 * 1000)
  const recent = (await getDb()
    .collection(COLLECTIONS.order_revisions)
    .find({ date: { $gte: args.startDate, $lte: args.endDate }, changedAt: { $gte: since } })
    .sort({ changedAt: -1 })
    .toArray()) as OrderRevisionDoc[]

  let body: string
  if (recent.length === 1) {
    const r = recent[0]
    const label = r.mealType.charAt(0).toUpperCase() + r.mealType.slice(1)
    body = `${label} ${r.date}: ${summariseChanges(r.changes)}`
  } else if (recent.length > 1) {
    const where = recent
      .slice(0, 3)
      .map((r) => `${r.date} ${r.mealType}`)
      .join(', ')
    body = `${recent.length} meals changed — ${where}${recent.length > 3 ? '…' : ''}. Open the week for details.`
  } else {
    body = `Orders for ${range} have been updated. Open the week to view them.`
  }

  await sendToUsers(vendors, 'Orders updated', body, { type: 'ordersSent' })
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
