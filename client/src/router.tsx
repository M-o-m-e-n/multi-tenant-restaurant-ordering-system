import { createBrowserRouter } from 'react-router-dom';

import { HomePage } from './pages/customer/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { AppShell } from './shared/ui/AppShell';

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
