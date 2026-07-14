import { useCallback, useEffect, useRef, useState } from 'react';
import { gqlRequest } from './client';
import {
  USERS,
  MENU_ITEMS,
  MY_SELECTIONS_FOR_WEEK,
  MY_MEAL_OPT_OUTS,
  MY_MEAL_DONE_FOR_WEEK,
  MEAL_DONE_STATUS,
  AGGREGATED_ORDER,
  CONFIRMED_ORDERS,
  FEEDBACKS_FOR_ADMIN,
  CONFIRMED_FEEDBACKS,
  MY_FEEDBACKS,
  CONFIRMED_ORDERS_FOR_RANGE,
  GET_SETTINGS,
  WEEKLY_EXPENSE,
  MEAL_CANCELLATIONS_FOR_RANGE,
  VENDOR_DAY_NOTES_FOR_RANGE,
} from './operations';
import type {
  AggregatedOrder,
  ConfirmedOrder,
  Feedback,
  MealType,
  MenuItem,
  Selection,
  User,
} from '../types';

/* ------------------------------------------------------------------ */
/* Generic query hook                                                  */
/* ------------------------------------------------------------------ */

export interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useGqlQuery<T>(
  query: string,
  variables?: Record<string, unknown>,
  options?: { skip?: boolean },
): QueryState<T> {
  const skip = options?.skip ?? false;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(!skip);
  const [error, setError] = useState<Error | null>(null);
  const varsKey = JSON.stringify(variables ?? {});
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async () => {
    if (skip) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await gqlRequest<T>(query, JSON.parse(varsKey));
      if (mounted.current) {
        setData(result);
        setError(null);
      }
    } catch (e) {
      if (mounted.current) setError(e as Error);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [query, varsKey, skip]);

  useEffect(() => {
    run();
  }, [run]);

  return { data, loading, error, refetch: run };
}

/* ------------------------------------------------------------------ */
/* Mutation helper                                                     */
/* ------------------------------------------------------------------ */

export function useMutation<TVars extends Record<string, unknown>, TData = any>(
  document: string,
) {
  const [loading, setLoading] = useState(false);
  const mutate = useCallback(
    async (variables?: TVars): Promise<TData> => {
      setLoading(true);
      try {
        return await gqlRequest<TData>(document, variables);
      } finally {
        setLoading(false);
      }
    },
    [document],
  );
  return { mutate, loading };
}

/* ------------------------------------------------------------------ */
/* Mappers (GraphQL id -> _id)                                         */
/* ------------------------------------------------------------------ */

const toUser = (g: any): User => ({
  _id: g.id,
  name: g.name,
  email: g.email,
  role: g.role,
  createdAt: g.createdAt ?? undefined,
});

const toMenuItem = (g: any): MenuItem => ({
  _id: g.id,
  name: g.name,
  mealType: g.mealType,
  unit: g.unit,
  pricePerUnit: g.pricePerUnit ?? undefined,
  createdAt: g.createdAt ?? undefined,
  updatedAt: g.updatedAt ?? undefined,
});

const toFeedback = (g: any): Feedback => ({
  _id: g.id,
  userId: g.userId,
  userName: g.userName,
  text: g.text,
  status: g.status,
  createdAt: g.createdAt,
  confirmedAt: g.confirmedAt ?? undefined,
  vendorReply: g.vendorReply ?? undefined,
  vendorReplyAt: g.vendorReplyAt ?? undefined,
});

/* ------------------------------------------------------------------ */
/* Typed data hooks                                                    */
/* ------------------------------------------------------------------ */

export function useUsers() {
  const q = useGqlQuery<{ users: any[] }>(USERS);
  return { users: (q.data?.users ?? []).map(toUser), ...q };
}

export function useMenuItems(mealType?: MealType) {
  const q = useGqlQuery<{ menuItems: any[] }>(
    MENU_ITEMS,
    mealType ? { mealType } : {},
  );
  return { items: (q.data?.menuItems ?? []).map(toMenuItem), ...q };
}

export function useMySelectionsForWeek(startDate: string) {
  const q = useGqlQuery<{ mySelectionsForWeek: any[] }>(
    MY_SELECTIONS_FOR_WEEK,
    { startDate },
    { skip: !startDate },
  );
  const selections: Selection[] = (q.data?.mySelectionsForWeek ?? []).map(
    (s: any) => ({ date: s.date, mealType: s.mealType, items: s.items }),
  );
  return { selections, ...q };
}

export interface MealOptOut {
  date: string;
  mealType: MealType;
}

export function useMyMealOptOuts(startDate: string) {
  const q = useGqlQuery<{ myMealOptOuts: any[] }>(
    MY_MEAL_OPT_OUTS,
    { startDate },
    { skip: !startDate },
  );
  const optOuts: MealOptOut[] = (q.data?.myMealOptOuts ?? []).map(
    (o: any) => ({ date: o.date, mealType: o.mealType as MealType }),
  );
  return { optOuts, ...q };
}

export interface MealDone {
  date: string;
  mealType: MealType;
}

export function useMyMealDoneForWeek(startDate: string) {
  const q = useGqlQuery<{ myMealDoneForWeek: any[] }>(
    MY_MEAL_DONE_FOR_WEEK,
    { startDate },
    { skip: !startDate },
  );
  const doneList: MealDone[] = (q.data?.myMealDoneForWeek ?? []).map(
    (o: any) => ({ date: o.date, mealType: o.mealType as MealType }),
  );
  return { doneList, ...q };
}

export interface MealDoneUser {
  userId: string;
  userName: string;
  mealType: MealType;
  markedAt: string;
}

export function useMealDoneStatus(date: string, mealType: MealType) {
  const q = useGqlQuery<{ mealDoneStatus: any[] }>(
    MEAL_DONE_STATUS,
    { date, mealType },
    { skip: !date || !mealType },
  );
  const doneUsers: MealDoneUser[] = (q.data?.mealDoneStatus ?? []).map(
    (o: any) => ({
      userId: o.userId,
      userName: o.userName,
      mealType: o.mealType as MealType,
      markedAt: o.markedAt,
    }),
  );
  return { doneUsers, ...q };
}

export function useAggregatedOrder(date: string, mealType: MealType) {
  const q = useGqlQuery<{ aggregatedOrder: AggregatedOrder | null }>(
    AGGREGATED_ORDER,
    { date, mealType },
    { skip: !date || !mealType },
  );
  const aggregated: AggregatedOrder = q.data?.aggregatedOrder ?? {
    date,
    mealType,
    items: [],
  };
  return { aggregated, ...q };
}

export function useConfirmedOrders(date: string) {
  const q = useGqlQuery<{ confirmedOrders: any[] }>(
    CONFIRMED_ORDERS,
    { date },
    { skip: !date },
  );
  const orders: ConfirmedOrder[] = (q.data?.confirmedOrders ?? []).map(
    (o: any) => ({ ...o, _id: o.id }),
  );
  return { orders, ...q };
}

export function useFeedbacksForAdmin() {
  const q = useGqlQuery<{ feedbacksForAdmin: any[] }>(FEEDBACKS_FOR_ADMIN);
  return { feedbacks: (q.data?.feedbacksForAdmin ?? []).map(toFeedback), ...q };
}

export function useConfirmedFeedbacks() {
  const q = useGqlQuery<{ confirmedFeedbacks: any[] }>(CONFIRMED_FEEDBACKS);
  return { feedbacks: (q.data?.confirmedFeedbacks ?? []).map(toFeedback), ...q };
}

export function useMyFeedbacks() {
  const q = useGqlQuery<{ myFeedbacks: any[] }>(MY_FEEDBACKS);
  return { feedbacks: (q.data?.myFeedbacks ?? []).map(toFeedback), ...q };
}

export function useConfirmedOrdersForRange(startDate: string, endDate: string) {
  const q = useGqlQuery<{ confirmedOrdersForRange: any[] }>(
    CONFIRMED_ORDERS_FOR_RANGE,
    { startDate, endDate },
    { skip: !startDate || !endDate },
  );
  const orders: ConfirmedOrder[] = (q.data?.confirmedOrdersForRange ?? []).map(
    (o: any) => ({ ...o, _id: o.id }),
  );
  return { orders, ...q };
}

export interface Settings {
  monthlyMealCap: number | null;
  deliveryCharge: number | null;
  updatedAt: string | null;
}

export function useSettings() {
  const q = useGqlQuery<{ getSettings: Settings }>(GET_SETTINGS);
  return { settings: q.data?.getSettings ?? { monthlyMealCap: null, deliveryCharge: null, updatedAt: null }, ...q };
}

export function useWeeklyExpense(startDate: string) {
  const q = useGqlQuery<{ weeklyExpense: number }>(
    WEEKLY_EXPENSE,
    { startDate },
    { skip: !startDate },
  );
  return { weeklyExpense: q.data?.weeklyExpense ?? 0, ...q };
}

export interface MealCancellation {
  id: string;
  date: string;
  mealType: MealType;
}

export function useMealCancellationsForRange(startDate: string, endDate: string) {
  const q = useGqlQuery<{ mealCancellationsForRange: MealCancellation[] }>(
    MEAL_CANCELLATIONS_FOR_RANGE,
    { startDate, endDate },
    { skip: !startDate || !endDate },
  );
  return { cancellations: q.data?.mealCancellationsForRange ?? [], ...q };
}

export interface VendorDayNote {
  id: string;
  date: string;
  finalAmount: number | null;
  comment: string;
  adminComment: string;
  updatedAt: string | null;
}

export function useVendorDayNotesForRange(startDate: string, endDate: string) {
  const q = useGqlQuery<{ vendorDayNotesForRange: VendorDayNote[] }>(
    VENDOR_DAY_NOTES_FOR_RANGE,
    { startDate, endDate },
    { skip: !startDate || !endDate },
  );
  return { notes: q.data?.vendorDayNotesForRange ?? [], ...q };
}
