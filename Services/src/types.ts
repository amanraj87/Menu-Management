import type { ObjectId } from 'mongodb'

export type MealType = 'breakfast' | 'lunch' | 'dinner'

export interface MenuItemDoc {
  _id: ObjectId
  name: string
  mealType: MealType
  unit: string
  pricePerUnit?: number
  /** Admin-controlled: whether users may choose this dish. Missing = offered (default true). */
  offered?: boolean
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
  passwordHash?: string
  createdAt?: Date
}

export interface FeedbackDoc {
  _id: ObjectId
  userId: ObjectId
  userName: string
  text: string
  status: 'pending' | 'confirmed' | 'rejected'
  createdAt: Date
  confirmedBy?: ObjectId
  confirmedAt?: Date
  vendorReply?: string
  vendorReplyBy?: ObjectId
  vendorReplyAt?: Date
}

export interface MealOptOutDoc {
  _id: ObjectId
  userId: ObjectId
  date: string
  mealType: MealType
  createdAt: Date
}

export interface MealDoneDoc {
  _id: ObjectId
  userId: ObjectId
  date: string
  mealType: MealType
  markedAt: Date
}

export interface MealCancellationDoc {
  _id: ObjectId
  date: string
  mealType: MealType
  cancelledBy: ObjectId
  cancelledAt: Date
}

export interface VendorDayNoteDoc {
  _id: ObjectId
  date: string
  finalAmount: number | null
  comment: string
  adminComment?: string
  updatedBy: ObjectId
  updatedAt: Date
}

export interface PushTokenDoc {
  _id: ObjectId
  token: string
  userId: ObjectId
  platform: string
  updatedAt: Date
}

export interface SettingsDoc {
  _id: ObjectId
  monthlyMealCap: number | null
  deliveryCharge: number | null
  updatedAt: Date
  updatedBy: ObjectId
}

export interface PriceHistoryDoc {
  _id: ObjectId
  menuItemId: ObjectId
  menuItemName: string
  oldPrice: number | null
  newPrice: number | null
  changedAt: Date
}

export interface ContextUser {
  userId: string
  role: 'person' | 'admin' | 'vendor'
}
