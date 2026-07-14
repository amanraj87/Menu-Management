import { useQuery, useMutation, useLazyQuery, useApolloClient } from '@apollo/client/react'
import {
  ME,
  LOGIN,
  SIGN_UP,
  RESET_PASSWORD,
  USERS,
  CREATE_USER,
  MENU_ITEMS,
  CREATE_MENU_ITEM,
  UPDATE_MENU_ITEM,
  DELETE_MENU_ITEM,
  MY_SELECTION,
  MY_SELECTIONS_FOR_WEEK,
  PUT_SELECTION,
  AGGREGATED_ORDER,
  AGGREGATED_ORDERS_FOR_RANGE,
  CONFIRM_ORDER,
  CONFIRM_ORDER_WITH_ITEMS,
  CONFIRMED_ORDERS,
  CREATE_FEEDBACK,
  FEEDBACKS_FOR_ADMIN,
  CONFIRM_FEEDBACK,
  REJECT_FEEDBACK,
  CONFIRMED_FEEDBACKS,
  MY_FEEDBACKS,
  REPLY_TO_FEEDBACK,
  DELETE_FEEDBACK,
  MY_MEAL_OPT_OUTS,
  TOGGLE_MEAL_OPT_OUT,
  MY_MEAL_DONE_FOR_WEEK,
  MARK_MEAL_DONE,
  MEAL_DONE_STATUS,
  CONFIRMED_ORDERS_FOR_RANGE,
  GET_SETTINGS,
  UPDATE_SETTINGS,
  WEEKLY_EXPENSE,
  MEAL_CANCELLATIONS_FOR_RANGE,
  TOGGLE_MEAL_CANCELLATION,
  VENDOR_DAY_NOTES_FOR_RANGE,
  UPDATE_VENDOR_DAY_NOTE,
  UPDATE_ADMIN_DAY_COMMENT,
} from './operations'
import { toUser, toMenuItem, toSelection, toAggregatedOrder, toConfirmedOrder, toFeedback } from './mappers'
import type { MealType, UserRole } from '@/shared/types'

interface MeData { me: { id: string; name: string; email: string; role: string } | null }
export function useMe(skip?: boolean, userId?: string | null) {
  const { data, loading, error } = useQuery<MeData>(ME, {
    skip: skip === true,
    variables: userId ? { userId } : {},
  })
  return { me: data?.me ? toUser(data.me) : null, isLoading: loading, error }
}

export function useLogin() {
  const [loginQuery, result] = useLazyQuery<{ login: { id: string; name: string; email: string; role: string } }>(LOGIN)
  return {
    login: (email: string, passwordHash: string) =>
      loginQuery({ variables: { email, passwordHash } }).then((res) => {
        if (res.data?.login) return toUser(res.data.login)
        throw new Error('Login failed')
      }),
    isPending: result.loading,
    error: result.error,
  }
}

export function useSignUp(onSuccess?: (user: { _id: string; name: string; role: string }) => void, onError?: (e: Error) => void) {
  const [mutate, result] = useMutation<{ signUp: { id: string; name: string; email: string; role: string } }>(SIGN_UP, {
    onCompleted: (data) => {
      if (data?.signUp) onSuccess?.(toUser(data.signUp))
    },
    onError: (e: Error) => onError?.(e),
  })
  return {
    signUp: (input: { name: string; email: string; passwordHash: string }) => mutate({ variables: { input } }),
    isPending: result.loading,
    error: result.error,
  }
}

export function useResetPassword(onSuccess?: () => void, onError?: (e: Error) => void) {
  const [mutate, result] = useMutation<{ resetPassword: boolean }>(RESET_PASSWORD, {
    onCompleted: () => onSuccess?.(),
    onError: (e: Error) => onError?.(e),
  })
  return {
    resetPassword: (email: string, newPasswordHash: string) =>
      mutate({ variables: { email, newPasswordHash } }),
    isPending: result.loading,
    error: result.error,
  }
}

interface UsersData { users: Array<{ id: string; name: string; email: string; role: string; createdAt?: string | null }> }
export function useUsers() {
  const { data, loading, error } = useQuery<UsersData>(USERS)
  const users = (data?.users ?? []).map(toUser)
  return { users, isLoading: loading, error }
}

export function useCreateUser(onSuccess?: () => void, onError?: (e: Error) => void) {
  const client = useApolloClient()
  const [mutate, result] = useMutation(CREATE_USER, {
    onCompleted: () => {
      void client.refetchQueries({ include: [USERS] })
      onSuccess?.()
    },
    onError: (e: Error) => onError?.(e),
  })
  return {
    createUser: (input: { name: string; email: string; role: UserRole }) =>
      mutate({ variables: { input } }),
    isPending: result.loading,
    error: result.error,
  }
}

interface MenuItemsData { menuItems: Array<{ id: string; name: string; mealType: string; unit: string; pricePerUnit?: number | null; createdAt?: string | null; updatedAt?: string | null }> }
export function useMenuItems(mealType?: MealType) {
  const { data, loading, error } = useQuery<MenuItemsData>(MENU_ITEMS, {
    variables: mealType ? { mealType } : {},
  })
  const items = (data?.menuItems ?? []).map(toMenuItem)
  return { items, isLoading: loading, error }
}

export function useCreateMenuItem(onSuccess?: () => void, onError?: (e: Error) => void) {
  const client = useApolloClient()
  const [mutate, result] = useMutation(CREATE_MENU_ITEM, {
    onCompleted: () => {
      void client.refetchQueries({ include: [MENU_ITEMS] })
      onSuccess?.()
    },
    onError: (e: Error) => onError?.(e),
  })
  return {
    createMenuItem: (input: { name: string; mealType: MealType; unit: string; pricePerUnit?: number }) =>
      mutate({ variables: { input } }),
    isPending: result.loading,
    error: result.error,
  }
}

export function useUpdateMenuItem(onSuccess?: () => void, onError?: (e: Error) => void) {
  const client = useApolloClient()
  const [mutate, result] = useMutation(UPDATE_MENU_ITEM, {
    onCompleted: () => {
      void client.refetchQueries({ include: [MENU_ITEMS] })
      onSuccess?.()
    },
    onError: (e: Error) => onError?.(e),
  })
  return {
    updateMenuItem: (id: string, input: { name?: string; mealType?: MealType; unit?: string; pricePerUnit?: number }) =>
      mutate({ variables: { id, input } }),
    isPending: result.loading,
    error: result.error,
  }
}

export function useDeleteMenuItem(onSuccess?: () => void, onError?: (e: Error) => void) {
  const client = useApolloClient()
  const [mutate, result] = useMutation(DELETE_MENU_ITEM, {
    onCompleted: () => {
      void client.refetchQueries({ include: [MENU_ITEMS] })
      onSuccess?.()
    },
    onError: (e: Error) => onError?.(e),
  })
  return {
    deleteMenuItem: (id: string) => mutate({ variables: { id } }),
    isPending: result.loading,
    error: result.error,
  }
}

interface MySelectionData { mySelection: { id: string; userId: string; date: string; mealType: string; items: { menuItemId: string; quantity: number }[]; updatedAt?: string | null } | null }
export function useMySelection(date: string, mealType: MealType) {
  const { data, loading, error } = useQuery<MySelectionData>(MY_SELECTION, {
    variables: { date, mealType },
    skip: !date || !mealType,
  })
  const selection = toSelection(data?.mySelection ?? null)
  return { selection, isLoading: loading, error }
}

interface MySelectionsForWeekData { mySelectionsForWeek: Array<{ id: string; date: string; mealType: string; items: { menuItemId: string; quantity: number }[] }> }
export function useMySelectionsForWeek(startDate: string) {
  const { data, loading, error } = useQuery<MySelectionsForWeekData>(MY_SELECTIONS_FOR_WEEK, {
    variables: { startDate },
    skip: !startDate,
  })
  const selections = (data?.mySelectionsForWeek ?? []).map((s) => ({ date: s.date, mealType: s.mealType as MealType, items: s.items }))
  return { selections, isLoading: loading, error }
}

export function usePutSelection(date: string, mealType: MealType, onSuccess?: () => void, onError?: (e: Error) => void) {
  const client = useApolloClient()
  const [mutate, result] = useMutation(PUT_SELECTION, {
    onCompleted: () => {
      void client.refetchQueries({ include: [MY_SELECTION] })
      onSuccess?.()
    },
    onError: (e: Error) => onError?.(e),
  })
  return {
    putSelection: (items: { menuItemId: string; quantity: number }[]) =>
      mutate({ variables: { input: { date, mealType, items } } }),
    isPending: result.loading,
    error: result.error,
  }
}

interface AggregatedOrderData { aggregatedOrder: { date: string; mealType: string; items: Array<{ menuItemId: string; name: string; unit: string; quantity: number; personBreakdown: Array<{ userId: string; userName: string; quantity: number }> }> } }
export function useAggregatedOrder(date: string, mealType: MealType) {
  const { data, loading, error } = useQuery<AggregatedOrderData>(AGGREGATED_ORDER, {
    variables: { date, mealType },
    skip: !date || !mealType,
  })
  const aggregated = data?.aggregatedOrder ? toAggregatedOrder(data.aggregatedOrder) : { date, mealType, items: [] }
  return { aggregated, isLoading: loading, error }
}

export function useConfirmOrder(
  date: string,
  mealType: MealType,
  onSuccess?: () => void,
  onError?: (e: Error) => void
) {
  const client = useApolloClient()
  const [mutate, result] = useMutation(CONFIRM_ORDER, {
    onCompleted: () => {
      void client.refetchQueries({ include: [AGGREGATED_ORDER, CONFIRMED_ORDERS] })
      onSuccess?.()
    },
    onError: (e: Error) => onError?.(e),
  })
  return {
    confirmOrder: () => mutate({ variables: { date, mealType } }),
    isPending: result.loading,
    error: result.error,
  }
}

export function useConfirmOrderWithItems(
  onSuccess?: () => void,
  onError?: (e: Error) => void
) {
  const client = useApolloClient()
  const [mutate, result] = useMutation(CONFIRM_ORDER_WITH_ITEMS, {
    onCompleted: () => {
      void client.refetchQueries({ include: [AGGREGATED_ORDER, CONFIRMED_ORDERS] })
      onSuccess?.()
    },
    onError: (e: Error) => onError?.(e),
  })
  return {
    confirmOrderWithItems: (date: string, mealType: MealType, items: { menuItemId: string; name: string; unit: string; quantity: number }[]) =>
      mutate({ variables: { date, mealType, items } }),
    isPending: result.loading,
    error: result.error,
  }
}

interface ConfirmedOrdersData { confirmedOrders: Array<{ id: string; date: string; mealType: string; items: Array<{ menuItemId: string; name: string; unit: string; quantity: number; personBreakdown: Array<{ userId: string; userName: string; quantity: number }> }>; confirmedBy: string; confirmedAt: string }> }
export function useConfirmedOrders(date: string) {
  const { data, loading, error } = useQuery<ConfirmedOrdersData>(CONFIRMED_ORDERS, {
    variables: { date },
    skip: !date,
  })
  const orders = (data?.confirmedOrders ?? []).map(toConfirmedOrder)
  return { orders, isLoading: loading, error }
}

export function useCreateFeedback(onSuccess?: () => void, onError?: (e: Error) => void) {
  const client = useApolloClient()
  const [mutate, result] = useMutation<{ createFeedback: { id: string; userId: string; userName: string; text: string; status: string; createdAt: string; confirmedAt?: string | null } }>(CREATE_FEEDBACK, {
    onCompleted: () => {
      void client.refetchQueries({ include: [FEEDBACKS_FOR_ADMIN, MY_FEEDBACKS] })
      onSuccess?.()
    },
    onError: (e: Error) => onError?.(e),
  })
  return {
    createFeedback: (text: string) => mutate({ variables: { input: { text } } }),
    isPending: result.loading,
    error: result.error,
  }
}

interface FeedbacksForAdminData { feedbacksForAdmin: Array<{ id: string; userId: string; userName: string; text: string; status: string; createdAt: string; confirmedAt?: string | null }> }
export function useFeedbacksForAdmin() {
  const { data, loading, error } = useQuery<FeedbacksForAdminData>(FEEDBACKS_FOR_ADMIN)
  const feedbacks = (data?.feedbacksForAdmin ?? []).map(toFeedback)
  return { feedbacks, isLoading: loading, error }
}

export function useConfirmFeedback(onSuccess?: () => void, onError?: (e: Error) => void) {
  const client = useApolloClient()
  const [mutate, result] = useMutation<{ confirmFeedback: { id: string; userId: string; userName: string; text: string; status: string; createdAt: string; confirmedAt?: string | null } }>(CONFIRM_FEEDBACK, {
    onCompleted: () => {
      void client.refetchQueries({ include: [FEEDBACKS_FOR_ADMIN, CONFIRMED_FEEDBACKS] })
      onSuccess?.()
    },
    onError: (e: Error) => onError?.(e),
  })
  return {
    confirmFeedback: (id: string) => mutate({ variables: { id } }),
    isPending: result.loading,
    error: result.error,
  }
}

export function useRejectFeedback(onSuccess?: () => void, onError?: (e: Error) => void) {
  const client = useApolloClient()
  const [mutate, result] = useMutation(REJECT_FEEDBACK, {
    onCompleted: () => {
      void client.refetchQueries({ include: [FEEDBACKS_FOR_ADMIN] })
      onSuccess?.()
    },
    onError: (e: Error) => onError?.(e),
  })
  return {
    rejectFeedback: (id: string) => mutate({ variables: { id } }),
    isPending: result.loading,
    error: result.error,
  }
}

interface ConfirmedFeedbacksData { confirmedFeedbacks: Array<{ id: string; userId: string; userName: string; text: string; status: string; createdAt: string; confirmedAt?: string | null; vendorReply?: string | null; vendorReplyAt?: string | null }> }
export function useConfirmedFeedbacks() {
  const { data, loading, error } = useQuery<ConfirmedFeedbacksData>(CONFIRMED_FEEDBACKS)
  const feedbacks = (data?.confirmedFeedbacks ?? []).map(toFeedback)
  return { feedbacks, isLoading: loading, error }
}

interface MyFeedbacksData { myFeedbacks: Array<{ id: string; userId: string; userName: string; text: string; status: string; createdAt: string; confirmedAt?: string | null; vendorReply?: string | null; vendorReplyAt?: string | null }> }
export function useMyFeedbacks() {
  const { data, loading, error } = useQuery<MyFeedbacksData>(MY_FEEDBACKS, { fetchPolicy: 'cache-and-network' })
  const feedbacks = (data?.myFeedbacks ?? []).map(toFeedback)
  return { feedbacks, isLoading: loading, error }
}

export function useDeleteFeedback(onSuccess?: () => void, onError?: (e: Error) => void) {
  const client = useApolloClient()
  const [mutate, result] = useMutation(DELETE_FEEDBACK, {
    onCompleted: () => {
      void client.refetchQueries({ include: [FEEDBACKS_FOR_ADMIN, CONFIRMED_FEEDBACKS, MY_FEEDBACKS] })
      onSuccess?.()
    },
    onError: (e: Error) => onError?.(e),
  })
  return {
    deleteFeedback: (id: string) => mutate({ variables: { id } }),
    isPending: result.loading,
    error: result.error,
  }
}

export function useReplyToFeedback(onSuccess?: () => void, onError?: (e: Error) => void) {
  const client = useApolloClient()
  const [mutate, result] = useMutation(REPLY_TO_FEEDBACK, {
    onCompleted: () => {
      void client.refetchQueries({ include: [CONFIRMED_FEEDBACKS, FEEDBACKS_FOR_ADMIN, MY_FEEDBACKS] })
      onSuccess?.()
    },
    onError: (e: Error) => onError?.(e),
  })
  return {
    replyToFeedback: (id: string, reply: string) => mutate({ variables: { id, reply } }),
    isPending: result.loading,
    error: result.error,
  }
}

interface MealOptOutsData { myMealOptOuts: { id: string; userId: string; date: string; mealType: string }[] }
export function useMyMealOptOuts(startDate: string) {
  const { data, loading, error, refetch } = useQuery<MealOptOutsData>(MY_MEAL_OPT_OUTS, {
    variables: { startDate },
    skip: !startDate,
  })
  const optOuts = (data?.myMealOptOuts ?? []).map(o => ({ date: o.date, mealType: o.mealType as MealType }))
  return { optOuts, isLoading: loading, error, refetch }
}

export function useToggleMealOptOut() {
  const [mutate, { loading }] = useMutation(TOGGLE_MEAL_OPT_OUT, {
    refetchQueries: [MY_MEAL_OPT_OUTS],
  })
  return { mutate, loading }
}

interface MealDoneForWeekData { myMealDoneForWeek: { id: string; userId: string; userName: string; date: string; mealType: string; markedAt: string }[] }
export function useMyMealDoneForWeek(startDate: string) {
  const { data, loading, error, refetch } = useQuery<MealDoneForWeekData>(MY_MEAL_DONE_FOR_WEEK, {
    variables: { startDate },
    skip: !startDate,
  })
  const doneList = (data?.myMealDoneForWeek ?? []).map(d => ({ date: d.date, mealType: d.mealType as MealType }))
  return { doneList, isLoading: loading, error, refetch }
}

export function useMarkMealDone() {
  const [mutate, { loading }] = useMutation(MARK_MEAL_DONE, {
    refetchQueries: [MY_MEAL_DONE_FOR_WEEK, MEAL_DONE_STATUS],
  })
  return { mutate, loading }
}

interface MealDoneStatusData { mealDoneStatus: { id: string; userId: string; userName: string; date: string; mealType: string; markedAt: string }[] }
export function useMealDoneStatus(date: string, mealType: MealType) {
  const { data, loading, error, refetch } = useQuery<MealDoneStatusData>(MEAL_DONE_STATUS, {
    variables: { date, mealType },
    skip: !date || !mealType,
  })
  const doneUsers = (data?.mealDoneStatus ?? []).map(d => ({ userId: d.userId, userName: d.userName, mealType: d.mealType as MealType, markedAt: d.markedAt }))
  return { doneUsers, isLoading: loading, error, refetch }
}

interface ConfirmedOrdersForRangeData { confirmedOrdersForRange: Array<{ id: string; date: string; mealType: string; items: Array<{ menuItemId: string; name: string; unit: string; quantity: number; personBreakdown: Array<{ userId: string; userName: string; quantity: number }> }>; confirmedBy: string; confirmedAt: string }> }
export function useConfirmedOrdersForRange(startDate: string, endDate: string) {
  const { data, loading, error, refetch } = useQuery<ConfirmedOrdersForRangeData>(CONFIRMED_ORDERS_FOR_RANGE, {
    variables: { startDate, endDate },
    skip: !startDate || !endDate,
  })
  const orders = (data?.confirmedOrdersForRange ?? []).map(toConfirmedOrder)
  return { orders, isLoading: loading, error, refetch }
}

interface AggregatedOrdersForRangeData {
  aggregatedOrdersForRange: Array<{ date: string; mealType: string; items: Array<{ menuItemId: string; name: string; unit: string; quantity: number; personBreakdown: Array<{ userId: string; userName: string; quantity: number }> }> }>
}
export function useAggregatedOrdersForRange(startDate: string, endDate: string) {
  const { data, loading, error, refetch } = useQuery<AggregatedOrdersForRangeData>(AGGREGATED_ORDERS_FOR_RANGE, {
    variables: { startDate, endDate },
    skip: !startDate || !endDate,
    fetchPolicy: 'cache-and-network',
  })
  const aggregated = (data?.aggregatedOrdersForRange ?? []).map(toAggregatedOrder)
  return { aggregated, isLoading: loading, error, refetch }
}

interface SettingsData { getSettings: { monthlyMealCap: number | null; deliveryCharge: number | null; updatedAt: string | null } }
export function useSettings() {
  const { data, loading, error, refetch } = useQuery<SettingsData>(GET_SETTINGS)
  return { settings: data?.getSettings ?? { monthlyMealCap: null, deliveryCharge: null, updatedAt: null }, isLoading: loading, error, refetch }
}

interface WeeklyExpenseData { weeklyExpense: number }
export function useWeeklyExpense(startDate: string) {
  const { data, loading, error, refetch } = useQuery<WeeklyExpenseData>(WEEKLY_EXPENSE, {
    variables: { startDate },
    skip: !startDate,
  })
  return { weeklyExpense: data?.weeklyExpense ?? 0, isLoading: loading, error, refetch }
}

interface MealCancellationsData { mealCancellationsForRange: { id: string; date: string; mealType: MealType }[] }
export function useMealCancellationsForRange(startDate: string, endDate: string) {
  const { data, loading, error, refetch } = useQuery<MealCancellationsData>(MEAL_CANCELLATIONS_FOR_RANGE, {
    variables: { startDate, endDate },
    skip: !startDate || !endDate,
  })
  return { cancellations: data?.mealCancellationsForRange ?? [], isLoading: loading, error, refetch }
}

export function useToggleMealCancellation() {
  const [mutate, { loading }] = useMutation(TOGGLE_MEAL_CANCELLATION)
  return {
    toggle: (date: string, mealType: MealType, cancelled: boolean) => mutate({ variables: { date, mealType, cancelled } }),
    isPending: loading,
  }
}

interface VendorDayNoteData {
  vendorDayNotesForRange: Array<{ id: string; date: string; finalAmount: number | null; comment: string; adminComment: string; updatedAt: string | null }>
}

export function useVendorDayNotesForRange(startDate: string, endDate: string) {
  const { data, loading, error, refetch } = useQuery<VendorDayNoteData>(VENDOR_DAY_NOTES_FOR_RANGE, {
    variables: { startDate, endDate },
    skip: !startDate || !endDate,
  })
  return { notes: data?.vendorDayNotesForRange ?? [], isLoading: loading, error, refetch }
}

export function useUpdateVendorDayNote() {
  const [mutate, { loading }] = useMutation(UPDATE_VENDOR_DAY_NOTE)
  return {
    update: (date: string, finalAmount: number | null, comment: string) => mutate({ variables: { date, finalAmount, comment } }),
    isPending: loading,
  }
}

export function useUpdateAdminDayComment() {
  const [mutate, { loading }] = useMutation(UPDATE_ADMIN_DAY_COMMENT)
  return {
    update: (date: string, comment: string) => mutate({ variables: { date, comment } }),
    isPending: loading,
  }
}

export function useUpdateSettings(onSuccess?: () => void, onError?: (e: Error) => void) {
  const client = useApolloClient()
  const [mutate, result] = useMutation(UPDATE_SETTINGS, {
    onCompleted: () => {
      void client.refetchQueries({ include: [GET_SETTINGS] })
      onSuccess?.()
    },
    onError: (e: Error) => onError?.(e),
  })
  return {
    updateSettings: (monthlyMealCap: number | null, deliveryCharge: number | null) => mutate({ variables: { monthlyMealCap, deliveryCharge } }),
    isPending: result.loading,
    error: result.error,
  }
}
