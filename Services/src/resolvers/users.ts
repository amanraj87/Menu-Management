import * as bcrypt from 'bcrypt'
import { ObjectId } from 'mongodb'
import { getDb } from '../db.js'
import { COLLECTIONS } from '../constants/collections.js'
import type { ContextUser } from '../types.js'
import type { UserDoc } from '../types.js'

const SALT_ROUNDS = 10

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

function isBcryptHash(value: string): boolean {
  return value.startsWith('$2b$') || value.startsWith('$2a$')
}

export async function login(
  _: unknown,
  args: { email: string; passwordHash: string }
): Promise<Record<string, unknown>> {
  const db = getDb()
  const doc = await db.collection(COLLECTIONS.users).findOne({ email: args.email.trim().toLowerCase() }) as UserDoc | null
  if (!doc) throw new Error('Invalid email or passwordHash')
  if (!doc.passwordHash) throw new Error('This account has no passwordHash set. Contact an admin.')
  const stored = doc.passwordHash
  const ok = isBcryptHash(stored)
    ? await bcrypt.compare(args.passwordHash, stored)
    : stored === args.passwordHash || stored.toLowerCase() === args.passwordHash.trim().toLowerCase()
  if (!ok) throw new Error('Invalid email or passwordHash')
  // Upgrade plain-text passwordHash to hash on next save (fire-and-forget)
  if (!isBcryptHash(stored)) {
    bcrypt.hash(args.passwordHash, SALT_ROUNDS).then((hash) => {
      db.collection(COLLECTIONS.users).updateOne(
        { _id: doc._id },
        { $set: { passwordHash: hash, updatedAt: new Date() } }
      ).catch(() => {})
    })
  }
  return toUser(doc)!
}

export async function signUp(
  _: unknown,
  args: { input: { name: string; email: string; passwordHash: string } }
): Promise<Record<string, unknown>> {
  const db = getDb()
  const email = args.input.email.trim().toLowerCase()
  const existing = await db.collection(COLLECTIONS.users).findOne({ email })
  if (existing) throw new Error('A user with this email already exists')
  const passwordHash = await bcrypt.hash(args.input.passwordHash, SALT_ROUNDS)
  const doc = {
    name: args.input.name.trim(),
    email,
    role: 'person' as const,
    passwordHash,
    createdAt: new Date(),
  }
  const result = await db.collection(COLLECTIONS.users).insertOne(doc)
  const inserted = await db.collection(COLLECTIONS.users).findOne({ _id: result.insertedId }) as UserDoc | null
  if (!inserted) throw new Error('Failed to create account')
  return toUser(inserted)!
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
