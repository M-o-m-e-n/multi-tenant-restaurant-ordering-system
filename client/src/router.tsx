import { createBrowserRouter } from 'react-router-dom';

import { RequireRole } from './features/auth/RequireRole';
import { AdminMenuPage } from './pages/admin/AdminMenuPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { CartPage } from './pages/customer/CartPage';
import { HomePage } from './pages/customer/HomePage';
import { MenuPage } from './pages/customer/MenuPage';
import { TableLandingPage } from './pages/customer/TableLandingPage';
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
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      {
        path: '/kitchen',
        element: (
          <RequireRole roles={['STAFF', 'ADMIN']}>
            <StaffPlaceholder title="Kitchen display" note="Live tickets arrive in M8." />
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
