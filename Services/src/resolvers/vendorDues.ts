import { ObjectId } from 'mongodb'
import { getDb } from '../db.js'
import { COLLECTIONS } from '../constants/collections.js'
import type {
  ContextUser,
  MealType,
  ConfirmedOrderDoc,
  MealCancellationDoc,
  MenuItemDoc,
  SettingsDoc,
  VendorDayNoteDoc,
} from '../types.js'

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner']

/** Add n days to a YYYY-MM-DD string using UTC-only math (no local-timezone drift). */
function addDaysISO(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Guard against an unbounded range scanning the whole collection. */
const MAX_DAYS = 400

/**
 * Admin: what the company owes the vendor over a date range.
 *
 * Deliberately mirrors the VENDOR's own week view rather than the admin week
 * view, so both sides agree on the payable figure:
 *  - basis is `confirmed_orders` (what was actually sent via "Send to Shefs"),
 *    NOT live selections — a payable amount must not shift when a user edits an
 *    old selection after the vendor already cooked it.
 *  - the vendor's `finalAmount` for a day WINS when set (it is their bill);
 *    otherwise we compute meals + deliveryCharge x activeMeals.
 *  - cancelled meals contribute nothing and drop their delivery share.
 *
 * Caveat (matches existing behaviour of both week views): confirmed orders do
 * not store the price paid, so item prices are read from the CURRENT menu. A
 * later price edit therefore also moves historical computed totals — the
 * vendor's finalAmount override is the escape hatch for a disputed day.
 */
export async function vendorDues(
  _: unknown,
  args: { startDate: string; endDate: string },
  context: { user?: ContextUser }
): Promise<Record<string, unknown>> {
  const user = context.user
  if (!user || user.role !== 'admin') throw new Error('Unauthorized: admin role required')
  if (args.endDate < args.startDate) throw new Error('endDate must not be before startDate')

  const db = getDb()

  const dates: string[] = []
  for (let d = args.startDate; d <= args.endDate; d = addDaysISO(d, 1)) {
    dates.push(d)
    if (dates.length > MAX_DAYS) throw new Error(`Date range too large (max ${MAX_DAYS} days)`)
  }

  const orders = (await db
    .collection(COLLECTIONS.confirmed_orders)
    .find({ date: { $gte: args.startDate, $lte: args.endDate } })
    .toArray()) as ConfirmedOrderDoc[]

  const cancellations = (await db
    .collection(COLLECTIONS.meal_cancellations)
    .find({ date: { $gte: args.startDate, $lte: args.endDate } })
    .toArray()) as MealCancellationDoc[]
  const cancelled = new Set(cancellations.map((c) => `${c.date}|${c.mealType}`))

  const notes = (await db
    .collection(COLLECTIONS.vendor_day_notes)
    .find({ date: { $gte: args.startDate, $lte: args.endDate } })
    .toArray()) as VendorDayNoteDoc[]
  const noteByDate = new Map(notes.map((n) => [n.date, n]))

  const settings = (await db.collection(COLLECTIONS.settings).findOne({})) as SettingsDoc | null
  const delivery = settings?.deliveryCharge ?? 0

  // Price lookup for every item referenced by the confirmed orders.
  const menuIds = new Set<string>()
  for (const o of orders) for (const i of o.items) menuIds.add(i.menuItemId.toString())
  const menuItems = menuIds.size > 0
    ? ((await db
        .collection(COLLECTIONS.menu_items)
        .find({ _id: { $in: [...menuIds].map((id) => new ObjectId(id)) } })
        .toArray()) as MenuItemDoc[])
    : []
  const priceById = new Map(menuItems.map((m) => [m._id.toString(), m.pricePerUnit ?? 0]))

  // date -> meal -> subtotal
  const subtotals = new Map<string, Map<MealType, number>>()
  const datesWithOrders = new Set<string>()
  for (const o of orders) {
    datesWithOrders.add(o.date)
    if (!subtotals.has(o.date)) subtotals.set(o.date, new Map())
    const perMeal = subtotals.get(o.date)!
    let sum = 0
    for (const i of o.items) sum += (priceById.get(i.menuItemId.toString()) ?? 0) * i.quantity
    perMeal.set(o.mealType, (perMeal.get(o.mealType) ?? 0) + sum)
  }

  const days: Record<string, unknown>[] = []
  let totalMeals = 0
  let totalDelivery = 0
  let totalOwed = 0
  let overrideCount = 0
  let overrideDelta = 0
  let notSentCount = 0

  for (const date of dates) {
    const perMeal = subtotals.get(date)
    let mealsSubtotal = 0
    let activeMeals = 0
    for (const meal of MEAL_TYPES) {
      if (cancelled.has(`${date}|${meal}`)) continue
      const sub = perMeal?.get(meal) ?? 0
      if (sub <= 0) continue
      mealsSubtotal += sub
      activeMeals++
    }
    const deliveryTotal = delivery * activeMeals
    const computedTotal = mealsSubtotal + deliveryTotal
    const finalAmount = noteByDate.get(date)?.finalAmount ?? null
    const owed = finalAmount ?? computedTotal
    const hasOverride = finalAmount != null && Math.round(finalAmount) !== Math.round(computedTotal)
    const sentToVendor = datesWithOrders.has(date)

    // Only flag "not sent" for days that should have had an order, i.e. skip
    // days the admin simply never had selections for.
    if (!sentToVendor && owed === 0) notSentCount++
    if (hasOverride) {
      overrideCount++
      overrideDelta += owed - computedTotal
    }
    totalMeals += mealsSubtotal
    totalDelivery += deliveryTotal
    totalOwed += owed

    days.push({
      date,
      mealsSubtotal,
      delivery: deliveryTotal,
      activeMeals,
      computedTotal,
      vendorFinalAmount: finalAmount,
      owed,
      hasOverride,
      sentToVendor,
    })
  }

  return {
    startDate: args.startDate,
    endDate: args.endDate,
    days,
    mealsSubtotal: totalMeals,
    delivery: totalDelivery,
    totalOwed,
    overrideCount,
    overrideDelta,
    notSentCount,
  }
}
