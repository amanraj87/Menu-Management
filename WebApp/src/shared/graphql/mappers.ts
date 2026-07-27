import type { MenuItem, Selection, SelectionItem, AggregatedOrder, ConfirmedOrder, User, Feedback } from '@/shared/types'

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

export function toMenuItem(g: { id: string; name: string; mealType: string; unit: string; pricePerUnit?: number | null; offeredDays?: number[] | null; createdAt?: string | null; updatedAt?: string | null }): MenuItem {
  return {
    _id: g.id,
    name: g.name,
    mealType: g.mealType as MenuItem['mealType'],
    unit: g.unit,
    pricePerUnit: g.pricePerUnit ?? undefined,
    offeredDays: g.offeredDays ?? [0, 1, 2, 3, 4, 5, 6],
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

export function toFeedback(g: { id: string; userId: string; userName: string; text: string; status: string; createdAt: string; confirmedAt?: string | null; vendorReply?: string | null; vendorReplyAt?: string | null }): Feedback {
  return {
    _id: g.id,
    userId: g.userId,
    userName: g.userName,
    text: g.text,
    status: g.status as Feedback['status'],
    createdAt: g.createdAt,
    confirmedAt: g.confirmedAt ?? undefined,
    vendorReply: g.vendorReply ?? undefined,
    vendorReplyAt: g.vendorReplyAt ?? undefined,
  }
}
