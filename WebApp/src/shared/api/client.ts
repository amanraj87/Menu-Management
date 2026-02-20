const BASE = import.meta.env.VITE_API_URL ?? '/api'

// Backend: use collections from src/shared/constants/collections.ts (users, menu_items, selections, confirmed_orders)
async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = path.startsWith('http') ? path : `${BASE}${path}`
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error((err as { message?: string }).message ?? res.statusText)
  }
  return res.json() as Promise<T>
}

export const api = {
  // Menu items (vendor CRUD; person/admin read)
  getMenuItems: (mealType?: string) =>
    request<{ items: import('@/shared/types').MenuItem[] }>(
      mealType ? `/menu-items?mealType=${mealType}` : '/menu-items'
    ),
  createMenuItem: (body: { name: string; mealType: import('@/shared/types').MealType; unit: string; defaultQuantity?: number }) =>
    request<{ item: import('@/shared/types').MenuItem }>('/menu-items', { method: 'POST', body: JSON.stringify(body) }),
  updateMenuItem: (id: string, body: Partial<Pick<import('@/shared/types').MenuItem, 'name' | 'unit' | 'defaultQuantity'>>) =>
    request<{ item: import('@/shared/types').MenuItem }>(`/menu-items/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteMenuItem: (id: string) =>
    request<{ ok: boolean }>(`/menu-items/${id}`, { method: 'DELETE' }),

  // Selections (person: get mine, submit/update)
  getMySelections: (date: string, mealType: import('@/shared/types').MealType) =>
    request<{ selection: import('@/shared/types').Selection | null }>(`/selections?date=${date}&mealType=${mealType}`),
  putSelection: (date: string, mealType: import('@/shared/types').MealType, items: import('@/shared/types').SelectionItem[]) =>
    request<{ selection: import('@/shared/types').Selection }>('/selections', {
      method: 'PUT',
      body: JSON.stringify({ date, mealType, items }),
    }),

  // Admin: aggregated view (pending) and confirm
  getAggregatedOrder: (date: string, mealType: import('@/shared/types').MealType) =>
    request<import('@/shared/types').AggregatedOrder>(`/orders/aggregated?date=${date}&mealType=${mealType}`),
  confirmOrder: (date: string, mealType: import('@/shared/types').MealType) =>
    request<{ order: import('@/shared/types').ConfirmedOrder }>('/orders/confirm', {
      method: 'POST',
      body: JSON.stringify({ date, mealType }),
    }),

  // Confirmed orders (vendor / admin read)
  getConfirmedOrders: (date: string) =>
    request<{ orders: import('@/shared/types').ConfirmedOrder[] }>(`/orders/confirmed?date=${date}`),
}
