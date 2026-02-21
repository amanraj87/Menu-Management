import { ObjectId } from 'mongodb'
import { getDb } from './db.js'
import { COLLECTIONS } from './constants/collections.js'
import type { ContextUser } from './types.js'
import type { UserDoc } from './types.js'

/**
 * Build context for each request. Uses X-User-Id (and optional X-User-Role) header,
 * or CURRENT_USER_ID env for dev. If X-User-Id is a valid ObjectId, fetches user from DB for role.
 */
export async function createContext(request: Request): Promise<{ user?: ContextUser }> {
  const userIdHeader = request.headers.get('x-user-id')
  const roleHeader = request.headers.get('x-user-role') as ContextUser['role'] | null
  const envUserId = process.env.CURRENT_USER_ID
  const rawUserId = userIdHeader ?? envUserId ?? null
  if (!rawUserId) return { user: undefined }

  let role: ContextUser['role'] = roleHeader ?? 'person'
  try {
    const db = getDb()
    const user = await db.collection(COLLECTIONS.users).findOne({ _id: new ObjectId(rawUserId) }) as UserDoc | null
    if (user) role = user.role
  } catch {
    // use header role or default
  }
  return { user: { userId: rawUserId, role } }
}
