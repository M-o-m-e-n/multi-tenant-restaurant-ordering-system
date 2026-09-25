import { createBrowserRouter } from 'react-router-dom';

import { RequireRole } from './features/auth/RequireRole';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { HomePage } from './pages/customer/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { StaffPlaceholder } from './pages/StaffPlaceholder';
import { AppShell } from './shared/ui/AppShell';

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <HomePage /> },
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
            <StaffPlaceholder title="Admin" note="The menu manager arrives in M4." />
          </RequireRole>
        ),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
