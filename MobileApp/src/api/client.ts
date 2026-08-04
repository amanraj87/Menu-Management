import AsyncStorage from '@react-native-async-storage/async-storage';
import { GRAPHQL_URL, SESSION_STORAGE_KEY } from '../config';

/**
 * Lightweight fetch-based GraphQL client. Mirrors the WebApp's Apollo setup:
 * every request carries the X-User-Id header for the logged-in user.
 */
let currentUserId: string | null = null;

export function setAuthUserId(id: string | null): void {
  currentUserId = id;
}

/**
 * Resolve the acting user id, falling back to the persisted session.
 *
 * The in-memory id is set by SessionContext, which never runs in a headless
 * context (e.g. a notification action handled while the app is backgrounded or
 * was launched fresh for the event). Reading AsyncStorage keeps those calls
 * authenticated. Sign-out clears both, so this can't resurrect a dead session.
 */
async function authUserId(): Promise<string | null> {
  if (currentUserId) return currentUserId;
  try {
    const raw = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { userId?: string };
    return parsed.userId ?? null;
  } catch {
    return null;
  }
}

export async function gqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const userId = await authUserId();
  let res: Response;
  try {
    res = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(userId ? { 'X-User-Id': userId } : {}),
      },
      body: JSON.stringify({ query, variables: variables ?? {} }),
    });
  } catch {
    throw new Error('Network error. Check your connection and try again.');
  }

  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Server error (${res.status}).`);
  }

  if (json.errors && json.errors.length) {
    throw new Error(json.errors[0]?.message ?? 'Request failed');
  }
  return json.data as T;
}
