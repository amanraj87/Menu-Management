import type { ObjectId } from 'mongodb'

export type MealType = 'breakfast' | 'lunch' | 'dinner'

export interface MenuItemDoc {
  _id: ObjectId
  name: string
  mealType: MealType
  unit: string
  defaultQuantity?: number
  createdAt?: Date
  updatedAt?: Date
}

export interface SelectionItemDoc {
  menuItemId: ObjectId
  quantity: number
}

export interface SelectionDoc {
  _id: ObjectId
  userId: ObjectId
  date: string
  mealType: MealType
  items: SelectionItemDoc[]
  updatedAt?: Date
}

export interface PersonBreakdownDoc {
  userId: ObjectId
  userName: string
  quantity: number
}

export interface ConfirmedOrderItemDoc {
  menuItemId: ObjectId
  name: string
  unit: string
  quantity: number
  personBreakdown: PersonBreakdownDoc[]
}

export interface ConfirmedOrderDoc {
  _id: ObjectId
  date: string
  mealType: MealType
  items: ConfirmedOrderItemDoc[]
  confirmedBy: ObjectId
  confirmedAt: Date
}

export interface UserDoc {
  _id: ObjectId
  name: string
  email: string
  role: 'person' | 'admin' | 'vendor'
  createdAt?: Date
}

export interface ContextUser {
  userId: string
  role: 'person' | 'admin' | 'vendor'
}
