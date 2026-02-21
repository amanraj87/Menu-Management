
import 'dotenv/config'
import { connectDb, closeDb, getDb } from '../src/db.js'
import { COLLECTIONS } from '../src/constants/collections.js'

const BREAKFAST_ITEMS: { name: string; pricePerUnit?: number }[] = [
  { name: 'Idly'},
  { name: 'Vada'},
  { name: 'Chutney'},
  { name: 'Sambar'},
  { name: 'Set Dosa'},
  { name: 'Ghee Dosa'},
  { name: 'Masal Dosa'},
  { name: 'poha'},
  { name: 'Kesari Bath'},
  { name: 'Aloo Paratha'},
  { name: 'Curd'},
  { name: 'Paneer paratha'},
  { name: 'Aloo Sandwich'},
  { name: 'Paneer Sandwich'},
  { name: 'Poori Sagu'},
  { name: 'Rava Idly'},
  { name: 'Akki Roti'},
  { name: 'Ragi Roti'},
  { name: 'Rava Roti'},
  { name: 'Bread Omlette'},
  { name: 'Egg Dosa'},
  { name: 'Egg roll'},
  { name: 'Rice bath'},
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
