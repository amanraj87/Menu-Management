import { MongoClient, Db } from 'mongodb'
import { COLLECTIONS } from './constants/collections.js'

const uri = process.env.MONGO_URI ?? 'mongodb://localhost:27017'
let client: MongoClient
let db: Db

/** Database name: MONGO_DB_NAME env, or first path segment of MONGO_URI, or "menu-management". */
function getDbName(): string {
  if (process.env.MONGO_DB_NAME) return process.env.MONGO_DB_NAME
  try {
    const path = new URL(uri).pathname.replace(/^\/+|\/+$/g, '')
    if (path) return path
  } catch {
    // not a valid URL (e.g. legacy format)
  }
  return 'foodops'
}

export async function connectDb(): Promise<Db> {
  if (db) return db
  client = new MongoClient(uri)
  await client.connect()
  const dbName = getDbName()
  db = client.db(dbName)

  await db.collection(COLLECTIONS.users).createIndex({ email: 1 }, { unique: true }).catch(() => {})
  await db.collection(COLLECTIONS.menu_items).createIndex({ mealType: 1 }).catch(() => {})
  await db.collection(COLLECTIONS.selections).createIndex(
    { userId: 1, date: 1, mealType: 1 },
    { unique: true }
  ).catch(() => {})
  await db.collection(COLLECTIONS.confirmed_orders).createIndex(
    { date: 1, mealType: 1 },
    { unique: true }
  ).catch(() => {})
  await db.collection(COLLECTIONS.meal_opt_outs).createIndex(
    { userId: 1, date: 1, mealType: 1 },
    { unique: true }
  ).catch(() => {})

  return db
}

export function getDb(): Db {
  if (!db) throw new Error('DB not connected. Call connectDb() first.')
  return db
}

export async function closeDb(): Promise<void> {
  if (client) await client.close()
}
