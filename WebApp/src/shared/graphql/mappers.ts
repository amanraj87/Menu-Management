import type { MenuItem, Selection, SelectionItem, AggregatedOrder, ConfirmedOrder, User } from '@/shared/types'

/** GraphQL returns id; app types use _id. Map so components keep using _id. */
export function toUser(g: { id: string; name: string; email: string; role: string; createdAt?: string | null }): User {
  return {
    _id: g.id,
    name: g.name,
    email: g.email,
    role: g.role as User['role'],
    createdAt: g.createdAt ?? undefined,
  }
}

export function toMenuItem(g: { id: string; name: string; mealType: string; unit: string; defaultQuantity?: number | null; createdAt?: string | null; updatedAt?: string | null }): MenuItem {
  return {
    _id: g.id,
    name: g.name,
    mealType: g.mealType as MenuItem['mealType'],
    unit: g.unit,
    defaultQuantity: g.defaultQuantity ?? undefined,
    createdAt: g.createdAt ?? undefined,
    updatedAt: g.updatedAt ?? undefined,
  }
}

export function toSelection(g: {
  id: string
  userId: string
  date: string
  mealType: string
  items: { menuItemId: string; quantity: number }[]
  updatedAt?: string | null
} | null): Selection | null {
  if (!g) return null
  return {
    _id: g.id,
    userId: g.userId,
    date: g.date,
    mealType: g.mealType as Selection['mealType'],
    items: g.items as SelectionItem[],
    updatedAt: g.updatedAt ?? undefined,
  }
}

export function toAggregatedOrder(g: {
  date: string
  mealType: string
  items: { menuItemId: string; name: string; unit: string; quantity: number; personBreakdown: { userId: string; userName: string; quantity: number }[] }[]
}): AggregatedOrder {
  return {
    date: g.date,
    mealType: g.mealType as AggregatedOrder['mealType'],
    items: g.items.map((i) => ({
      menuItemId: i.menuItemId,
      name: i.name,
      unit: i.unit,
      quantity: i.quantity,
      personBreakdown: i.personBreakdown,
    })),
  }
}

export function toConfirmedOrder(g: {
  id: string
  date: string
  mealType: string
  items: { menuItemId: string; name: string; unit: string; quantity: number; personBreakdown: { userId: string; userName: string; quantity: number }[] }[]
  confirmedBy: string
  confirmedAt: string
}): ConfirmedOrder {
  return {
    _id: g.id,
    date: g.date,
    mealType: g.mealType as ConfirmedOrder['mealType'],
    items: g.items.map((i) => ({
      menuItemId: i.menuItemId,
      name: i.name,
      unit: i.unit,
      quantity: i.quantity,
      personBreakdown: i.personBreakdown,
    })),
    confirmedBy: g.confirmedBy,
    confirmedAt: g.confirmedAt,
  }
}
