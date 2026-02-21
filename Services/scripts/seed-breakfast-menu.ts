
import 'dotenv/config'
import { connectDb, closeDb, getDb } from '../src/db.js'
import { COLLECTIONS } from '../src/constants/collections.js'

const BREAKFAST_ITEMS: { name: string; pricePerUnit?: number }[] = [
  { name: 'Idly/vada(3/2pcs) with chutney and sambar', pricePerUnit: 100 },
  { name: 'Set Dosa(2 pcs) with chutney and sambar', pricePerUnit: 80 },
  { name: 'Ghee Dosa(2 pcs)with chutney and sambar', pricePerUnit: 80 },
  { name: 'Masal Dosa with chutney', pricePerUnit: 69 },
  { name: 'poha(500ml)with chutney', pricePerUnit: 70 },
  { name: 'Karabath/Kesari Bath(350/200g)box with chutney', pricePerUnit: 90 },
  { name: 'Aloo Paratha (2 pcs) with curd', pricePerUnit: 104 },
  { name: 'Paneer paratha (2 pcs) with curd', pricePerUnit: 110 },
  { name: 'Aloo Sandwich (2 pc) with ketup', pricePerUnit: 90 },
  { name: 'Paneer Sandwich (pc) with ketup', pricePerUnit: 65 },
  { name: 'Poori Sagu(4 poori)', pricePerUnit: 110 },
  { name: 'Rava Idly(4 idly) with chutney', pricePerUnit: 100 },
  { name: 'Akki Roti (2 pieces) with chutney', pricePerUnit: 70 },
  { name: 'Ragi Roti(2 pieces) with chutney', pricePerUnit: 70 },
  { name: 'Rava Roti(2 pieces) with chutney', pricePerUnit: 70 },
  { name: 'Bread Omlette (2 pieces)', pricePerUnit: 80 },
  { name: 'Egg Dosa(2 dosa) with chutney', pricePerUnit: 100 },
  { name: 'Egg roll (2 roll)', pricePerUnit: 75 },
  { name: 'Rice bath(Lemon, puliyogare, tomato)', pricePerUnit: 70 },
  { name: 'Ghee Podi Idly' },
  { name: 'Sabudhana Kichadi' },
  { name: 'Capsicum and onion Sandwich' },
  { name: 'Egg toast' },
  { name: 'Veggie Omlet' },
  { name: 'Sprout Chat' },
  { name: 'Chole Batttura' },
  { name: 'Dhokla' },
  { name: 'Muli Paratha' },
  { name: 'Palak Paratha' },
  { name: 'Gobi Paratha' },
  { name: 'Aloo Sandwich' },
  { name: 'Veg Sandwich' },
  { name: 'Bhindi do pyaza' },
  { name: 'Toyisid Mandakki' },
  { name: 'Paneer Capsicum Curry' },
  { name: 'Onion Capsicum Curry' },
  { name: 'palak paneer' },
]

async function main() {
  await connectDb()
  const db = getDb()
  const col = db.collection(COLLECTIONS.menu_items)
  const now = new Date()
  const docs = BREAKFAST_ITEMS.map((item) => ({
    name: item.name,
    mealType: 'breakfast',
    unit: 'portion',
    ...(item.pricePerUnit != null && { pricePerUnit: item.pricePerUnit }),
    createdAt: now,
    updatedAt: now,
  }))
  const result = await col.insertMany(docs)
  console.log(`Inserted ${result.insertedCount} breakfast menu items.`)
  await closeDb()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
