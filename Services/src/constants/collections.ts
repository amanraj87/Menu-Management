/**
 * MongoDB collection names. Must match WebApp docs/MONGO_COLLECTIONS.md.
 */
export const COLLECTIONS = {
  users: 'users',
  menu_items: 'menu_items',
  selections: 'selections',
  confirmed_orders: 'confirmed_orders',
  feedback: 'feedback',
  meal_opt_outs: 'meal_opt_outs',
  meal_done: 'meal_done',
  meal_cancellations: 'meal_cancellations',
  settings: 'settings',
  vendor_day_notes: 'vendor_day_notes',
  job_runs: 'job_runs',
} as const

export type CollectionName = keyof typeof COLLECTIONS
