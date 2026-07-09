import { ObjectId } from 'mongodb'
import { getDb } from '../db.js'
import { COLLECTIONS } from '../constants/collections.js'
import type { ContextUser, SettingsDoc } from '../types.js'

function toSettings(doc: SettingsDoc | null): Record<string, unknown> {
  return {
    monthlyMealCap: doc?.monthlyMealCap ?? null,
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
  args: { monthlyMealCap: number | null },
  context: { user?: ContextUser }
): Promise<Record<string, unknown>> {
  const user = context.user
  if (!user || user.role !== 'admin') throw new Error('Unauthorized: admin role required')
  const db = getDb()
  const result = await db.collection(COLLECTIONS.settings).findOneAndUpdate(
    {},
    { $set: { monthlyMealCap: args.monthlyMealCap, updatedAt: new Date(), updatedBy: new ObjectId(user.userId) } },
    { returnDocument: 'after', upsert: true }
  ) as SettingsDoc | null
  return toSettings(result)
}
