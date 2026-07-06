import { GRAPHQL_URL } from '../config';

/**
 * Lightweight fetch-based GraphQL client. Mirrors the WebApp's Apollo setup:
 * every request carries the X-User-Id header for the logged-in user.
 */
let currentUserId: string | null = null;

export function setAuthUserId(id: string | null): void {
  currentUserId = id;
}

export async function gqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(currentUserId ? { 'X-User-Id': currentUserId } : {}),
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
