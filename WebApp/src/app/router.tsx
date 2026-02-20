import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { AuthLayout } from './layouts/AuthLayout'
import { AdminLayout } from './layouts/AdminLayout'
import { PersonLayout } from './layouts/PersonLayout'
import { VendorLayout } from './layouts/VendorLayout'
import { LoginPage } from '@/app/(auth)/LoginPage'
import { AdminDashboard } from '@/app/(admin)/AdminDashboard'
import { AdminCombinedOrders } from '@/app/(admin)/AdminCombinedOrders'
import { ChangeHistory } from '@/app/(admin)/ChangeHistory'
import { PersonChooseMeals } from '@/app/(person)/PersonChooseMeals'
import { VendorMenuManager } from '@/app/(vendor)/VendorMenuManager'
import { VendorToday } from '@/app/(vendor)/VendorToday'
import { VendorTomorrow } from '@/app/(vendor)/VendorTomorrow'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/person" replace /> },
      {
        element: <AuthLayout />,
        children: [
          { path: 'login', element: <LoginPage /> },
        ],
      },
      {
        path: 'person',
        element: <PersonLayout />,
        children: [
          { index: true, element: <PersonChooseMeals /> },
        ],
      },
      {
        path: 'admin',
        element: <AdminLayout />,
        children: [
          { index: true, element: <AdminDashboard /> },
          { path: 'orders', element: <AdminCombinedOrders /> },
          { path: 'history', element: <ChangeHistory /> },
        ],
      },
      {
        path: 'vendor',
        element: <VendorLayout />,
        children: [
          { index: true, element: <VendorToday /> },
          { path: 'menu', element: <VendorMenuManager /> },
          { path: 'tomorrow', element: <VendorTomorrow /> },
        ],
      },
    ],
  },
])
