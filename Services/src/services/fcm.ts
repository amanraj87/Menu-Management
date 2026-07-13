/**
 * FCM (Firebase Cloud Messaging) sender — HTTP v1 API.
 *
 * Sends the remote notifications P2/V1/A1/A2/A3. Auth uses a Firebase
 * service-account key supplied via the FIREBASE_SERVICE_ACCOUNT env var (the
 * full JSON, as a single value). If that var is absent or malformed, every
 * send is a silent no-op — so resolvers can call these freely and the app keeps
 * working even before FCM is configured.
 *
 * All functions are best-effort and never throw: a push failure must never
 * break the mutation that triggered it.
 */
import { GoogleAuth } from 'google-auth-library'
import { ObjectId } from 'mongodb'
import { getDb } from '../db.js'
import { COLLECTIONS } from '../constants/collections.js'
import type { PushTokenDoc } from '../types.js'

const MESSAGING_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging'

let auth: GoogleAuth | null = null
let projectId: string | null = null
let configChecked = false

/** Lazily build the GoogleAuth client from the env var. Returns null if unconfigured. */
function getAuth(): GoogleAuth | null {
  if (configChecked) return auth
  configChecked = true
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) {
    console.warn('[fcm] FIREBASE_SERVICE_ACCOUNT not set — push disabled')
    return null
  }
  try {
    const creds = JSON.parse(raw) as { project_id?: string }
    projectId = creds.project_id ?? null
    auth = new GoogleAuth({ credentials: creds as object, scopes: [MESSAGING_SCOPE] })
  } catch (e) {
    console.error('[fcm] FIREBASE_SERVICE_ACCOUNT is not valid JSON — push disabled', e)
    auth = null
  }
  return auth
}

async function accessToken(): Promise<string | null> {
  const a = getAuth()
  if (!a) return null
  try {
    const client = await a.getClient()
    const t = await client.getAccessToken()
    return t.token ?? null
  } catch (e) {
    console.error('[fcm] failed to mint access token', e)
    return null
  }
}

/** Distinct device tokens registered for the given users. */
async function tokensForUsers(userIds: ObjectId[]): Promise<string[]> {
  if (userIds.length === 0) return []
  const db = getDb()
  const docs = (await db
    .collection<PushTokenDoc>(COLLECTIONS.push_tokens)
    .find({ userId: { $in: userIds } })
    .toArray()) as PushTokenDoc[]
  return [...new Set(docs.map(d => d.token))]
}

/** User _ids for a given role (e.g. all admins / all vendors). */
export async function userIdsByRole(role: string): Promise<ObjectId[]> {
  const db = getDb()
  const docs = await db
    .collection(COLLECTIONS.users)
    .find({ role })
    .project({ _id: 1 })
    .toArray()
  return docs.map(d => d._id as ObjectId)
}

/**
 * Send a notification to every device of the given users. No-op if FCM is
 * unconfigured or none of the users have a registered device. Prunes tokens
 * that FCM reports as unregistered.
 */
export async function sendToUsers(
  userIds: (ObjectId | string)[],
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  try {
    const ids = userIds.map(id => (typeof id === 'string' ? new ObjectId(id) : id))
    if (ids.length === 0) return
    const token = await accessToken()
    if (!token || !projectId) return
    const tokens = await tokensForUsers(ids)
    if (tokens.length === 0) return

    const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`
    await Promise.all(
      tokens.map(async deviceToken => {
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: {
                token: deviceToken,
                notification: { title, body },
                data: data ?? {},
                android: { priority: 'high' },
              },
            }),
          })
          if (!res.ok) {
            const errText = await res.text().catch(() => '')
            // Stale/unregistered token — remove it so we stop trying.
            if (res.status === 404 || res.status === 400) {
              await getDb()
                .collection(COLLECTIONS.push_tokens)
                .deleteOne({ token: deviceToken })
                .catch(() => {})
            }
            console.error(`[fcm] send failed (${res.status})`, errText)
          }
        } catch (e) {
          console.error('[fcm] send error', e)
        }
      }),
    )
  } catch (e) {
    console.error('[fcm] sendToUsers error', e)
  }
}
