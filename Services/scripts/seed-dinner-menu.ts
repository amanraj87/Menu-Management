/**
 * Seed dinner items into menu_items collection.
 * Run from Services folder: npx tsx scripts/seed-dinner-menu.ts
 * Uses MONGO_URI / MONGO_DB_NAME from .env (or defaults).
 */
import 'dotenv/config'
import { connectDb, closeDb, getDb } from '../src/db.js'
import { COLLECTIONS } from '../src/constants/collections.js'

const DINNER_ITEMS: { name: string }[] = [
  { name: 'Steamed Rice' },
  { name: 'Pulka' },
  { name: 'Boiled egg' },
  { name: 'Gulab Jamun' },
  { name: 'Dal Fry' },
  { name: 'Bhindi' },
  { name: 'Aloo Paratha' },
  { name: 'Egg Bhurji' },
  { name: 'Plain Curd' },
  { name: 'Dal Tadka' },
  { name: 'Curd Rice' },
  { name: 'Aloo matar Gravy' },
  { name: 'Any Sweet' },
  { name: 'Paneer Paratha' },
  { name: 'Chicken Kabab' },
  { name: 'Chola Battura' },
  { name: 'Mushroom Masala' },
  { name: 'Steam Rice' },
  { name: 'Mixed Veg' },
  { name: 'Curd' },
  { name: 'Bottle gourd sabzi' },
]

async function main() {
  await connectDb()
  const db = getDb()
  const col = db.collection(COLLECTIONS.menu_items)
  const now = new Date()
  const docs = DINNER_ITEMS.map((item) => ({
    name: item.name,
    mealType: 'dinner',
    unit: 'portion',
    createdAt: now,
    updatedAt: now,
  }))
  const result = await col.insertMany(docs)
  console.log(`Inserted ${result.insertedCount} dinner menu items.`)
  await closeDb()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
