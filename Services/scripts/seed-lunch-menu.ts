/**
 * Seed lunch items into menu_items collection.
 * Run from Services folder: npx tsx scripts/seed-lunch-menu.ts
 * Uses MONGO_URI / MONGO_DB_NAME from .env (or defaults).
 */
import 'dotenv/config'
import { connectDb, closeDb, getDb } from '../src/db.js'
import { COLLECTIONS } from '../src/constants/collections.js'

const LUNCH_ITEMS: { name: string }[] = [
  { name: 'Chicken Dum Briyani' },
  { name: 'Pulka' },
  { name: 'Raita' },
  { name: 'Steam Rice' },
  { name: 'Dal Fry' },
  { name: 'Aloo Jeera' },
  { name: 'Steamed Rice' },
  { name: 'Paneer Butter Masala' },
  { name: 'Chicken Butter Masala' },
  { name: 'Lemon Rice' },
  { name: 'Chana Masala' },
  { name: 'Kadai Chicken' },
  { name: 'Salad' },
  { name: 'Butter Chicken' },
  { name: 'Bhindi do pyaza' },
  { name: 'Kadai Paneer' },
  { name: 'Brinjal' },
  { name: 'Jeera Rice' },
  { name: 'Dal Makhni' },
  { name: 'Chicken Curry' },
  { name: 'Boiled Green Vegetable' },
  { name: 'Palakura Pappu' },
  { name: 'Egg Curry' },
  { name: 'Rajma' },
]

async function main() {
  await connectDb()
  const db = getDb()
  const col = db.collection(COLLECTIONS.menu_items)
  const now = new Date()
  const docs = LUNCH_ITEMS.map((item) => ({
    name: item.name,
    mealType: 'lunch',
    unit: 'portion',
    createdAt: now,
    updatedAt: now,
  }))
  const result = await col.insertMany(docs)
  console.log(`Inserted ${result.insertedCount} lunch menu items.`)
  await closeDb()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
