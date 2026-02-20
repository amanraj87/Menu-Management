/**
 * MongoDB collection names. Backend API should read/write these collections.
 * See docs/MONGO_COLLECTIONS.md for schema.
 */
export const COLLECTIONS = {
  users: 'users',
  menu_items: 'menu_items',
  selections: 'selections',
  confirmed_orders: 'confirmed_orders',
} as const

export type CollectionName = keyof typeof COLLECTIONS
