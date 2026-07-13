import { ObjectId } from 'mongodb'
import { getDb } from '../db.js'
import { COLLECTIONS } from '../constants/collections.js'
import type { ContextUser } from '../types.js'
import type { FeedbackDoc, UserDoc } from '../types.js'

function toFeedback(doc: FeedbackDoc): Record<string, unknown> {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    userName: doc.userName,
    text: doc.text,
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
    confirmedAt: doc.confirmedAt?.toISOString() ?? null,
    vendorReply: doc.vendorReply ?? null,
    vendorReplyAt: doc.vendorReplyAt?.toISOString() ?? null,
  }
}

export async function createFeedback(
  _: unknown,
  args: { input: { text: string } },
  context: { user?: ContextUser }
): Promise<Record<string, unknown>> {
  const user = context.user
  if (!user) throw new Error('Unauthorized: login required')
  const text = (args.input?.text ?? '').trim()
  if (!text) throw new Error('Feedback text is required')

  const db = getDb()
  const users = await db.collection(COLLECTIONS.users).findOne({ _id: new ObjectId(user.userId) }) as UserDoc | null
  const userName = users?.name ?? 'Unknown'

  const doc: Omit<FeedbackDoc, '_id'> = {
    userId: new ObjectId(user.userId),
    userName,
    text,
    status: 'pending',
    createdAt: new Date(),
  }
  const result = await db.collection(COLLECTIONS.feedback).insertOne(doc as FeedbackDoc)
  const inserted = await db.collection(COLLECTIONS.feedback).findOne({ _id: result.insertedId }) as FeedbackDoc
  return toFeedback(inserted)
}

export async function feedbacksForAdmin(
  _: unknown,
  __: unknown,
  context: { user?: ContextUser }
): Promise<Record<string, unknown>[]> {
  const user = context.user
  if (!user || user.role !== 'admin') throw new Error('Unauthorized: admin role required')

  const db = getDb()
  const list = await db
    .collection(COLLECTIONS.feedback)
    .find({})
    .sort({ createdAt: -1 })
    .toArray() as FeedbackDoc[]
  return list.map(toFeedback)
}

export async function confirmFeedback(
  _: unknown,
  args: { id: string },
  context: { user?: ContextUser }
): Promise<Record<string, unknown>> {
  const user = context.user
  if (!user || user.role !== 'admin') throw new Error('Unauthorized: admin role required')

  const db = getDb()
  const id = new ObjectId(args.id)
  const result = await db.collection(COLLECTIONS.feedback).findOneAndUpdate(
    { _id: id, status: 'pending' },
    { $set: { status: 'confirmed', confirmedBy: new ObjectId(user.userId), confirmedAt: new Date() } },
    { returnDocument: 'after' }
  ) as FeedbackDoc | null
  if (!result) throw new Error('Feedback not found or already confirmed')
  return toFeedback(result)
}

export async function rejectFeedback(
  _: unknown,
  args: { id: string },
  context: { user?: ContextUser }
): Promise<Record<string, unknown>> {
  const user = context.user
  if (!user || user.role !== 'admin') throw new Error('Unauthorized: admin role required')

  const db = getDb()
  const id = new ObjectId(args.id)
  const result = await db.collection(COLLECTIONS.feedback).findOneAndUpdate(
    { _id: id, status: 'pending' },
    { $set: { status: 'rejected', rejectedBy: new ObjectId(user.userId), rejectedAt: new Date() } },
    { returnDocument: 'after' }
  ) as FeedbackDoc | null
  if (!result) throw new Error('Feedback not found or already processed')
  return toFeedback(result)
}

export async function confirmedFeedbacks(
  _: unknown,
  __: unknown,
  context: { user?: ContextUser }
): Promise<Record<string, unknown>[]> {
  const user = context.user
  if (!user || user.role !== 'vendor') throw new Error('Unauthorized: vendor role required')

  const db = getDb()
  const list = await db
    .collection(COLLECTIONS.feedback)
    .find({ status: 'confirmed' })
    .sort({ confirmedAt: -1 })
    .toArray() as FeedbackDoc[]
  return list.map(toFeedback)
}

export async function deleteFeedback(
  _: unknown,
  args: { id: string },
  context: { user?: ContextUser }
): Promise<boolean> {
  const user = context.user
  if (!user || user.role !== 'admin') throw new Error('Unauthorized: admin role required')

  const db = getDb()
  const result = await db.collection(COLLECTIONS.feedback).deleteOne({ _id: new ObjectId(args.id) })
  if (result.deletedCount === 0) throw new Error('Feedback not found')
  return true
}

export async function myFeedbacks(
  _: unknown,
  __: unknown,
  context: { user?: ContextUser }
): Promise<Record<string, unknown>[]> {
  const user = context.user
  if (!user) throw new Error('Unauthorized: login required')

  const db = getDb()
  const list = await db
    .collection(COLLECTIONS.feedback)
    .find({ userId: new ObjectId(user.userId) })
    .sort({ createdAt: -1 })
    .toArray() as FeedbackDoc[]
  return list.map(toFeedback)
}

export async function replyToFeedback(
  _: unknown,
  args: { id: string; reply: string },
  context: { user?: ContextUser }
): Promise<Record<string, unknown>> {
  const user = context.user
  if (!user || user.role !== 'vendor') throw new Error('Unauthorized: vendor role required')
  const reply = (args.reply ?? '').trim()
  if (!reply) throw new Error('Reply text is required')

  const db = getDb()
  const result = await db.collection(COLLECTIONS.feedback).findOneAndUpdate(
    { _id: new ObjectId(args.id), status: 'confirmed' },
    { $set: { vendorReply: reply, vendorReplyBy: new ObjectId(user.userId), vendorReplyAt: new Date() } },
    { returnDocument: 'after' }
  ) as FeedbackDoc | null
  if (!result) throw new Error('Feedback not found or not available to reply')
  return toFeedback(result)
}
