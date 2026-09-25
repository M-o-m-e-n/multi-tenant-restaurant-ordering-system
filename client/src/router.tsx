import { createBrowserRouter } from 'react-router-dom';

import { RequireRole } from './features/auth/RequireRole';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminMenuPage } from './pages/admin/AdminMenuPage';
import { ReportsPage } from './pages/admin/ReportsPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { CartPage } from './pages/customer/CartPage';
import { CheckoutPage } from './pages/customer/CheckoutPage';
import { HomePage } from './pages/customer/HomePage';
import { MenuPage } from './pages/customer/MenuPage';
import { MyOrdersPage } from './pages/customer/MyOrdersPage';
import { OrderTrackerPage } from './pages/customer/OrderTrackerPage';
import { PayPage } from './pages/customer/PayPage';
import { ReceiptPage } from './pages/customer/ReceiptPage';
import { ReservePage } from './pages/customer/ReservePage';
import { TableLandingPage } from './pages/customer/TableLandingPage';
import { KdsPage } from './pages/kitchen/KdsPage';
import { KitchenTicketPrintPage } from './pages/kitchen/KitchenTicketPrintPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PosPage } from './pages/pos/PosPage';
import { ReservationsPage } from './pages/pos/ReservationsPage';
import { TableMapPage } from './pages/pos/TableMapPage';
import { AppShell } from './shared/ui/AppShell';

export const router = createBrowserRouter([
  // Print views sit outside the app shell: no navigation on paper.
  {
    path: '/kitchen/tickets/:id/print',
    element: (
      <RequireRole roles={['STAFF', 'ADMIN']}>
        <KitchenTicketPrintPage />
      </RequireRole>
    ),
  },
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/menu', element: <MenuPage /> },
      { path: '/t/:token', element: <TableLandingPage /> },
      { path: '/cart', element: <CartPage /> },
      {
        path: '/checkout',
        element: (
          <RequireRole roles={['CUSTOMER', 'STAFF', 'ADMIN']}>
            <CheckoutPage />
          </RequireRole>
        ),
      },
      {
        path: '/orders',
        element: (
          <RequireRole roles={['CUSTOMER', 'STAFF', 'ADMIN']}>
            <MyOrdersPage />
          </RequireRole>
        ),
      },
      {
        path: '/orders/:id/receipt',
        element: (
          <RequireRole roles={['CUSTOMER', 'STAFF', 'ADMIN']}>
            <ReceiptPage />
          </RequireRole>
        ),
      },
      {
        path: '/orders/:id/pay',
        element: (
          <RequireRole roles={['CUSTOMER', 'STAFF', 'ADMIN']}>
            <PayPage />
          </RequireRole>
        ),
      },
      {
        path: '/orders/:id',
        element: (
          <RequireRole roles={['CUSTOMER', 'STAFF', 'ADMIN']}>
            <OrderTrackerPage />
          </RequireRole>
        ),
      },
      {
        path: '/reserve',
        element: (
          <RequireRole roles={['CUSTOMER', 'STAFF', 'ADMIN']}>
            <ReservePage />
          </RequireRole>
        ),
      },
      {
        path: '/pos/reservations',
        element: (
          <RequireRole roles={['STAFF', 'ADMIN']}>
            <ReservationsPage />
          </RequireRole>
        ),
      },
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      {
        path: '/kitchen',
        element: (
          <RequireRole roles={['STAFF', 'ADMIN']}>
            <KdsPage />
          </RequireRole>
        ),
      },
      {
        path: '/pos',
        element: (
          <RequireRole roles={['STAFF', 'ADMIN']}>
            <PosPage />
          </RequireRole>
        ),
      },
      {
        path: '/admin',
        element: (
          <RequireRole roles={['ADMIN']}>
            <AdminDashboardPage />
          </RequireRole>
        ),
      },
      {
        path: '/pos/tables',
        element: (
          <RequireRole roles={['STAFF', 'ADMIN']}>
            <TableMapPage />
          </RequireRole>
        ),
      },
      {
        path: '/admin/reports',
        element: (
          <RequireRole roles={['ADMIN']}>
            <ReportsPage />
          </RequireRole>
        ),
      },
      {
        path: '/admin/menu',
        element: (
          <RequireRole roles={['ADMIN']}>
            <AdminMenuPage />
          </RequireRole>
        ),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
