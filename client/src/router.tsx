import { createBrowserRouter } from 'react-router-dom';

import { RequireRole } from './features/auth/RequireRole';
import { AdminMenuPage } from './pages/admin/AdminMenuPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { CartPage } from './pages/customer/CartPage';
import { CheckoutPage } from './pages/customer/CheckoutPage';
import { HomePage } from './pages/customer/HomePage';
import { MenuPage } from './pages/customer/MenuPage';
import { MyOrdersPage } from './pages/customer/MyOrdersPage';
import { OrderTrackerPage } from './pages/customer/OrderTrackerPage';
import { TableLandingPage } from './pages/customer/TableLandingPage';
import { KdsPage } from './pages/kitchen/KdsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { TableMapPage } from './pages/pos/TableMapPage';
import { StaffPlaceholder } from './pages/StaffPlaceholder';
import { AppShell } from './shared/ui/AppShell';

export const router = createBrowserRouter([
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
        path: '/orders/:id',
        element: (
          <RequireRole roles={['CUSTOMER', 'STAFF', 'ADMIN']}>
            <OrderTrackerPage />
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
            <StaffPlaceholder
              title="Point of sale"
              note="Tables and payments arrive in M5 and M9."
            />
          </RequireRole>
        ),
      },
      {
        path: '/admin',
        element: (
          <RequireRole roles={['ADMIN']}>
            <StaffPlaceholder
              title="Admin"
              note="Manage the menu from Admin → Menu. Reports arrive in M11."
            />
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
