import { ObjectId } from 'mongodb'
import { getDb } from '../db.js'
import { COLLECTIONS } from '../constants/collections.js'
import type { ContextUser, PushTokenDoc } from '../types.js'

/**
 * Store an FCM device token against the signed-in user. Upsert keyed by token
 * so a device that switches users re-points to the new user (never duplicates).
 */
export async function registerPushToken(
  _: unknown,
  args: { token: string; platform: string },
  context: { user?: ContextUser },
): Promise<boolean> {
  const user = context.user
  if (!user) throw new Error('Unauthorized: login required')
  const token = (args.token ?? '').trim()
  if (!token) throw new Error('Token is required')

  const db = getDb()
  await db.collection<PushTokenDoc>(COLLECTIONS.push_tokens).updateOne(
    { token },
    {
      $set: {
        token,
        userId: new ObjectId(user.userId),
        platform: args.platform || 'android',
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  )
  return true
}

/** Remove a device token (best-effort; returns true even if it was absent). */
export async function unregisterPushToken(
  _: unknown,
  args: { token: string },
  context: { user?: ContextUser },
): Promise<boolean> {
  const user = context.user
  if (!user) throw new Error('Unauthorized: login required')
  const token = (args.token ?? '').trim()
  if (!token) return true

  const db = getDb()
  await db.collection<PushTokenDoc>(COLLECTIONS.push_tokens).deleteOne({ token })
  return true
}
