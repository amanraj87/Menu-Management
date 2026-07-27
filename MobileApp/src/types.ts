export type MealType = 'breakfast' | 'lunch' | 'dinner';
export type UserRole = 'person' | 'admin' | 'vendor';

export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner'];

export interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt?: string;
}

export interface MenuItem {
  _id: string;
  name: string;
  mealType: MealType;
  unit: string;
  pricePerUnit?: number;
  /** Admin-controlled: whether users may choose this dish. Defaults to true. */
  offered: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SelectionItem {
  menuItemId: string;
  quantity: number;
}

export interface Selection {
  date: string;
  mealType: MealType;
  items: SelectionItem[];
}

export interface PersonBreakdownItem {
  userId: string;
  userName: string;
  quantity: number;
}

export interface AggregatedOrderItem {
  menuItemId: string;
  name: string;
  unit: string;
  quantity: number;
  personBreakdown: PersonBreakdownItem[];
}

export interface AggregatedOrder {
  date: string;
  mealType: MealType;
  items: AggregatedOrderItem[];
}

export interface ConfirmedOrderItem {
  menuItemId: string;
  name: string;
  unit: string;
  quantity: number;
  personBreakdown: PersonBreakdownItem[];
}

export interface ConfirmedOrder {
  _id: string;
  date: string;
  mealType: MealType;
  items: ConfirmedOrderItem[];
  confirmedBy: string;
  confirmedAt: string;
}

export interface Feedback {
  _id: string;
  userId: string;
  userName: string;
  text: string;
  status: 'pending' | 'confirmed' | 'rejected';
  createdAt: string;
  confirmedAt?: string;
  vendorReply?: string;
  vendorReplyAt?: string;
}

export interface UserSession {
  userId: string;
  role: UserRole;
  name: string;
}
