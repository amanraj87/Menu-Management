import { ObjectId } from 'mongodb'
import { getDb } from '../db.js'
import { COLLECTIONS } from '../constants/collections.js'
import type { ContextUser } from '../types.js'
import type { UserDoc } from '../types.js'

export async function me(
  _: unknown,
  args: { userId?: string | null },
  context: { user?: ContextUser }
): Promise<Record<string, unknown> | null> {
  const db = getDb()
  const idToLookup = args.userId ?? context.user?.userId
  if (!idToLookup) return null
  const col = db.collection(COLLECTIONS.users)
  let doc: UserDoc | null = null
  if (ObjectId.isValid(idToLookup) && idToLookup.length === 24) {
    doc = await col.findOne({ _id: new ObjectId(idToLookup) }) as UserDoc | null
  }
  if (!doc) {
    doc = await col.findOne({ _id: idToLookup } as unknown as { _id: ObjectId }) as UserDoc | null
  }
  if (!doc) {
    if (args.userId) {
      throw new Error('User not found with that ID. Check that the ID exists in the users collection (MongoDB _id, 24 hex characters).')
    }
    return null
  }
  return {
    id: doc._id.toString(),
    name: doc.name,
    email: doc.email,
    role: doc.role,
  }
}
