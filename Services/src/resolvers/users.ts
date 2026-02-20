import { ObjectId } from 'mongodb'
import { getDb } from '../db.js'
import { COLLECTIONS } from '../constants/collections.js'
import type { ContextUser } from '../types.js'
import type { UserDoc } from '../types.js'

function toUser(doc: UserDoc | null): Record<string, unknown> | null {
  if (!doc) return null
  return {
    id: doc._id.toString(),
    name: doc.name,
    email: doc.email,
    role: doc.role,
    createdAt: doc.createdAt?.toISOString() ?? null,
  }
}

export async function users(
  _: unknown,
  _args: Record<string, never>,
  context: { user?: ContextUser }
): Promise<Record<string, unknown>[]> {
  const user = context.user
  if (!user || user.role !== 'admin') throw new Error('Unauthorized: admin role required to list users')
  const db = getDb()
  const docs = await db.collection(COLLECTIONS.users).find({}).toArray() as UserDoc[]
  return docs.map((d) => toUser(d)!)
}

export async function createUser(
  _: unknown,
  args: { input: { name: string; email: string; role: 'person' | 'admin' | 'vendor' } },
  context: { user?: ContextUser }
): Promise<Record<string, unknown>> {
  const user = context.user
  if (!user || user.role !== 'admin') throw new Error('Unauthorized: admin role required to create users')
  const db = getDb()
  const existing = await db.collection(COLLECTIONS.users).findOne({ email: args.input.email })
  if (existing) throw new Error('A user with this email already exists')
  const doc = {
    name: args.input.name,
    email: args.input.email,
    role: args.input.role,
    createdAt: new Date(),
  }
  const result = await db.collection(COLLECTIONS.users).insertOne(doc)
  const inserted = await db.collection(COLLECTIONS.users).findOne({ _id: result.insertedId }) as UserDoc | null
  if (!inserted) throw new Error('Failed to create user')
  return toUser(inserted)!
}
