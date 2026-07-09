import { ObjectId } from 'mongodb'
import { getDb } from '../db.js'
import { COLLECTIONS } from '../constants/collections.js'
import type { ContextUser, SettingsDoc } from '../types.js'

function toSettings(doc: SettingsDoc | null): Record<string, unknown> {
  return {
    monthlyMealCap: doc?.monthlyMealCap ?? null,
    deliveryCharge: doc?.deliveryCharge ?? null,
    updatedAt: doc?.updatedAt?.toISOString() ?? null,
  }
}

export async function getSettings(
  _: unknown,
  __: unknown,
  context: { user?: ContextUser }
): Promise<Record<string, unknown>> {
  const user = context.user
  if (!user) throw new Error('Unauthorized')
  const db = getDb()
  const doc = await db.collection(COLLECTIONS.settings).findOne({}) as SettingsDoc | null
  return toSettings(doc)
}

export async function updateSettings(
  _: unknown,
  args: { monthlyMealCap?: number | null; deliveryCharge?: number | null },
  context: { user?: ContextUser }
): Promise<Record<string, unknown>> {
  const user = context.user
  if (!user || user.role !== 'admin') throw new Error('Unauthorized: admin role required')
  const db = getDb()
  for (const [label, v] of [['monthlyMealCap', args.monthlyMealCap], ['deliveryCharge', args.deliveryCharge]] as const) {
    if (v != null && (!Number.isFinite(v) || v < 0)) {
      throw new Error(`${label} must be a non-negative number`)
    }
  }
  // Only overwrite fields the caller actually provided (undefined = leave as-is).
  const set: Record<string, unknown> = { updatedAt: new Date(), updatedBy: new ObjectId(user.userId) }
  if (args.monthlyMealCap !== undefined) set.monthlyMealCap = args.monthlyMealCap
  if (args.deliveryCharge !== undefined) set.deliveryCharge = args.deliveryCharge
  const result = await db.collection(COLLECTIONS.settings).findOneAndUpdate(
    {},
    { $set: set },
    { returnDocument: 'after', upsert: true }
  ) as SettingsDoc | null
  return toSettings(result)
}
