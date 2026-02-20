/**
 * MongoDB collection names. Must match WebApp docs/MONGO_COLLECTIONS.md.
 */
export const COLLECTIONS = {
  users: 'users',
  menu_items: 'menu_items',
  selections: 'selections',
  confirmed_orders: 'confirmed_orders',
} as const

export type CollectionName = keyof typeof COLLECTIONS
