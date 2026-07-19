import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { AuthLayout } from './layouts/AuthLayout'
import { AdminLayout } from './layouts/AdminLayout'
import { PersonLayout } from './layouts/PersonLayout'
import { VendorLayout } from './layouts/VendorLayout'
import { LoginPage } from '@/app/(auth)/LoginPage'
import { AdminWeekView } from '@/app/(admin)/AdminWeekView'
import { AdminFeedback } from '@/app/(admin)/AdminFeedback'
import { AdminUsers } from '@/app/(admin)/AdminUsers'
import { PersonWeekView } from '@/app/(person)/PersonWeekView'
import { PersonTodayView } from '@/app/(person)/PersonTodayView'
import { PersonFeedback } from '@/app/(person)/PersonFeedback'
import { ViewMenu } from '@/app/shared/ViewMenu'
import { AdminPriceHistory } from '@/app/(admin)/AdminPriceHistory'
import { VendorMenuManager } from '@/app/(vendor)/VendorMenuManager'
import { VendorWeekView } from '@/app/(vendor)/VendorWeekView'
import { VendorFeedback } from '@/app/(vendor)/VendorFeedback'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        path: '',
        element: <AuthLayout />,
        children: [{ index: true, element: <LoginPage /> }],
      },
      {
        path: 'person',
        element: <PersonLayout />,
        children: [
          { index: true, element: <Navigate to="/person/week" replace /> },
          { path: 'today', element: <PersonTodayView /> },
          { path: 'week', element: <PersonWeekView /> },
          { path: 'menu', element: <ViewMenu /> },
          { path: 'feedback', element: <PersonFeedback /> },
        ],
      },
      {
        path: 'admin',
        element: <AdminLayout />,
        children: [
          { index: true, element: <Navigate to="/admin/week" replace /> },
          { path: 'week', element: <AdminWeekView /> },
          { path: 'users', element: <AdminUsers /> },
          { path: 'feedback', element: <AdminFeedback /> },
          { path: 'menu', element: <ViewMenu /> },
          { path: 'price-history', element: <AdminPriceHistory /> },
        ],
      },
      {
        path: 'vendor',
        element: <VendorLayout />,
        children: [
          { index: true, element: <Navigate to="/vendor/week" replace /> },
          { path: 'feedback', element: <VendorFeedback /> },
          { path: 'menu', element: <VendorMenuManager /> },
          { path: 'week', element: <VendorWeekView /> },
        ],
      },
    ],
  },
])
