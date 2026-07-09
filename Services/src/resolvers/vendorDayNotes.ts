import { ObjectId } from 'mongodb'
import { getDb } from '../db.js'
import { COLLECTIONS } from '../constants/collections.js'
import type { VendorDayNoteDoc, ContextUser } from '../types.js'

function toNote(doc: VendorDayNoteDoc) {
  return {
    id: doc._id.toHexString(),
    date: doc.date,
    finalAmount: doc.finalAmount,
    comment: doc.comment,
    updatedAt: doc.updatedAt?.toISOString() ?? null,
  }
}

export async function vendorDayNotesForRange(
  _: unknown,
  args: { startDate: string; endDate: string },
) {
  const db = getDb()
  const docs = (await db
    .collection(COLLECTIONS.vendor_day_notes)
    .find({ date: { $gte: args.startDate, $lte: args.endDate } })
    .toArray()) as VendorDayNoteDoc[]
  return docs.map(toNote)
}

export async function updateVendorDayNote(
  _: unknown,
  args: { date: string; finalAmount: number | null; comment: string },
  context: { user?: ContextUser },
) {
  const user = context.user
  if (!user || (user.role !== 'vendor' && user.role !== 'admin')) {
    throw new Error('Unauthorized: vendor or admin role required')
  }
  const db = getDb()
  const col = db.collection(COLLECTIONS.vendor_day_notes)
  const now = new Date()
  const result = await col.findOneAndUpdate(
    { date: args.date },
    {
      $set: {
        finalAmount: args.finalAmount ?? null,
        comment: args.comment,
        updatedBy: new ObjectId(user.userId),
        updatedAt: now,
      },
      $setOnInsert: { date: args.date },
    },
    { upsert: true, returnDocument: 'after' },
  )
  return toNote(result as unknown as VendorDayNoteDoc)
}
