import { useQuery, useMutation, useApolloClient } from '@apollo/client/react'
import {
  ME,
  USERS,
  CREATE_USER,
  MENU_ITEMS,
  CREATE_MENU_ITEM,
  UPDATE_MENU_ITEM,
  DELETE_MENU_ITEM,
  MY_SELECTION,
  PUT_SELECTION,
  AGGREGATED_ORDER,
  CONFIRM_ORDER,
  CONFIRMED_ORDERS,
} from './operations'
import { toUser, toMenuItem, toSelection, toAggregatedOrder, toConfirmedOrder } from './mappers'
import type { MealType, UserRole } from '@/shared/types'

interface MeData { me: { id: string; name: string; email: string; role: string } | null }
export function useMe(skip?: boolean, userId?: string | null) {
  const { data, loading, error } = useQuery<MeData>(ME, {
    skip: skip === true,
    variables: userId ? { userId } : {},
  })
  return { me: data?.me ?? null, isLoading: loading, error }
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

interface MenuItemsData { menuItems: Array<{ id: string; name: string; mealType: string; unit: string; defaultQuantity?: number | null; createdAt?: string | null; updatedAt?: string | null }> }
export function useMenuItems(mealType?: MealType) {
  const { data, loading, error } = useQuery<MenuItemsData>(MENU_ITEMS, {
    variables: mealType ? { mealType } : {},
  })
  const items = (data?.menuItems ?? []).map(toMenuItem)
  return { items, isLoading: loading, error }
}

export function useCreateMenuItem(mealType: MealType, onSuccess?: () => void, onError?: (e: Error) => void) {
  const client = useApolloClient()
  const [mutate, result] = useMutation(CREATE_MENU_ITEM, {
    onCompleted: () => {
      void client.refetchQueries({ include: [MENU_ITEMS] })
      onSuccess?.()
    },
    onError: (e: Error) => onError?.(e),
  })
  return {
    createMenuItem: (input: { name: string; unit: string; defaultQuantity?: number }) =>
      mutate({ variables: { input: { ...input, mealType } } }),
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
    updateMenuItem: (id: string, input: { name?: string; unit?: string; defaultQuantity?: number }) =>
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

interface ConfirmedOrdersData { confirmedOrders: Array<{ id: string; date: string; mealType: string; items: Array<{ menuItemId: string; name: string; unit: string; quantity: number; personBreakdown: Array<{ userId: string; userName: string; quantity: number }> }>; confirmedBy: string; confirmedAt: string }> }
export function useConfirmedOrders(date: string) {
  const { data, loading, error } = useQuery<ConfirmedOrdersData>(CONFIRMED_ORDERS, {
    variables: { date },
    skip: !date,
  })
  const orders = (data?.confirmedOrders ?? []).map(toConfirmedOrder)
  return { orders, isLoading: loading, error }
}
