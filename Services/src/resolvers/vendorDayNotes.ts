import { ObjectId } from 'mongodb'
import { getDb } from '../db.js'
import { COLLECTIONS } from '../constants/collections.js'
import { sendToUsers, userIdsByRole } from '../services/fcm.js'
import type { VendorDayNoteDoc, ContextUser } from '../types.js'

function toNote(doc: VendorDayNoteDoc) {
  return {
    id: doc._id.toHexString(),
    date: doc.date,
    finalAmount: doc.finalAmount,
    comment: doc.comment,
    adminComment: doc.adminComment ?? '',
    updatedAt: doc.updatedAt?.toISOString() ?? null,
  }
}

/** Shorten a comment for a notification body. */
function preview(text: string, max = 60): string {
  const t = text.trim()
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
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

  // Read the prior state first so we can tell what the vendor actually changed.
  const existing = (await col.findOne({ date: args.date })) as VendorDayNoteDoc | null

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

  // A1: only a VENDOR editing a day notifies admins (an admin editing it
  // themselves shouldn't self-notify). Tailor the message to what changed so a
  // newly-added comment is surfaced (task: notify admins on vendor comments).
  if (user.role === 'vendor') {
    const admins = await userIdsByRole('admin')
    const amount = args.finalAmount ?? null
    const newComment = (args.comment ?? '').trim()
    const commentChanged = newComment !== '' && newComment !== (existing?.comment ?? '').trim()
    const amountChanged = amount !== (existing?.finalAmount ?? null)

    let title: string
    let body: string
    if (commentChanged && amountChanged) {
      title = 'Vendor updated a day'
      body = `${args.date}: final ₹${amount} — “${preview(newComment)}”`
    } else if (commentChanged) {
      title = 'Vendor left a comment'
      body = `${args.date}: “${preview(newComment)}”`
    } else {
      title = 'Vendor set a day’s final amount'
      body =
        amount != null
          ? `${args.date}: final amount set to ₹${amount}`
          : `${args.date}: final amount updated`
    }
    await sendToUsers(admins, title, body, {
      type: 'vendorDayNote',
      date: args.date,
    })
  }

  return toNote(result as unknown as VendorDayNoteDoc)
}

export async function updateAdminDayComment(
  _: unknown,
  args: { date: string; comment: string },
  context: { user?: ContextUser },
) {
  const user = context.user
  if (!user || user.role !== 'admin') {
    throw new Error('Unauthorized: admin role required')
  }
  const db = getDb()
  const col = db.collection(COLLECTIONS.vendor_day_notes)
  const now = new Date()
  const result = await col.findOneAndUpdate(
    { date: args.date },
    {
      $set: {
        adminComment: args.comment,
        updatedBy: new ObjectId(user.userId),
        updatedAt: now,
      },
      // Ensure the doc has the vendor fields when created by an admin comment.
      $setOnInsert: { date: args.date, comment: '', finalAmount: null },
    },
    { upsert: true, returnDocument: 'after' },
  )
  return toNote(result as unknown as VendorDayNoteDoc)
}
