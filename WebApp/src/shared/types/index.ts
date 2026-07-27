export type MealType = 'breakfast' | 'lunch' | 'dinner'
export type UserRole = 'person' | 'admin' | 'vendor'

export interface User {
  _id: string
  name: string
  email: string
  role: UserRole
  createdAt?: string
}

export interface MenuItem {
  _id: string
  name: string
  mealType: MealType
  unit: string
  pricePerUnit?: number
  /** Admin-controlled: weekdays (0=Sun … 6=Sat) users may choose this dish on. */
  offeredDays: number[]
  createdAt?: string
  updatedAt?: string
}

export interface SelectionItem {
  menuItemId: string
  quantity: number
}

export interface Selection {
  _id: string
  userId: string
  date: string
  mealType: MealType
  items: SelectionItem[]
  updatedAt?: string
}

export interface PersonBreakdownItem {
  userId: string
  userName: string
  quantity: number
}

export interface ConfirmedOrderItem {
  menuItemId: string
  name: string
  unit: string
  quantity: number
  personBreakdown: PersonBreakdownItem[]
}

export interface ConfirmedOrder {
  _id: string
  date: string
  mealType: MealType
  items: ConfirmedOrderItem[]
  confirmedBy: string
  confirmedAt: string
}

/** Aggregated view for admin: item + total qty + who added what (before confirm) */
export interface AggregatedOrderItem {
  menuItemId: string
  name: string
  unit: string
  quantity: number
  personBreakdown: PersonBreakdownItem[]
}

export interface AggregatedOrder {
  date: string
  mealType: MealType
  items: AggregatedOrderItem[]
}

export interface Feedback {
  _id: string
  userId: string
  userName: string
  text: string
  status: 'pending' | 'confirmed' | 'rejected'
  createdAt: string
  confirmedAt?: string
  vendorReply?: string
  vendorReplyAt?: string
}
