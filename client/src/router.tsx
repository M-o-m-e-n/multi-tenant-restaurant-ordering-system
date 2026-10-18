import { createBrowserRouter } from 'react-router-dom';

import { tenant } from './brand';
import { RequireRole } from './features/auth/RequireRole';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { CartPage } from './pages/customer/CartPage';
import { CheckoutPage } from './pages/customer/CheckoutPage';
import { HomePage } from './pages/customer/HomePage';
import { MenuPage } from './pages/customer/MenuPage';
import { MyOrdersPage } from './pages/customer/MyOrdersPage';
import { OrderTrackerPage } from './pages/customer/OrderTrackerPage';
import { ReceiptPage } from './pages/customer/ReceiptPage';
import { ReservePage } from './pages/customer/ReservePage';
import { TableLandingPage } from './pages/customer/TableLandingPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { AppShell } from './shared/ui/AppShell';
import { lazyComponent, lazyPage } from './shared/ui/lazyPage';

// Staff, admin and card-payment screens load on demand, so a guest never
// downloads Recharts, Stripe or the KDS (NFR-P2).
const AdminDashboardPage = lazyPage(
  () => import('./pages/admin/AdminDashboardPage'),
  'AdminDashboardPage',
);
const AdminMenuPage = lazyPage(() => import('./pages/admin/AdminMenuPage'), 'AdminMenuPage');
const ReportsPage = lazyPage(() => import('./pages/admin/ReportsPage'), 'ReportsPage');
const PayPage = lazyPage(() => import('./pages/customer/PayPage'), 'PayPage');
const KdsPage = lazyPage(() => import('./pages/kitchen/KdsPage'), 'KdsPage');
const KitchenTicketPrintPage = lazyPage(
  () => import('./pages/kitchen/KitchenTicketPrintPage'),
  'KitchenTicketPrintPage',
);
const PosPage = lazyPage(() => import('./pages/pos/PosPage'), 'PosPage');
const ReservationsPage = lazyPage(() => import('./pages/pos/ReservationsPage'), 'ReservationsPage');
const TableMapPage = lazyPage(() => import('./pages/pos/TableMapPage'), 'TableMapPage');
const BranchesPage = lazyPage(() => import('./pages/customer/BranchesPage'), 'BranchesPage');
const ContactPage = lazyPage(() => import('./pages/customer/ContactPage'), 'ContactPage');
const BranchesAdminPage = lazyPage(
  () => import('./pages/admin/BranchesAdminPage'),
  'BranchesAdminPage',
);
const MessagesPage = lazyPage(() => import('./pages/admin/MessagesPage'), 'MessagesPage');

/**
 * The site pages the tenant turns on (ADR-032). A tenant may draw a page
 * itself; otherwise the generic one is used. About has no generic page.
 */
function sitePages() {
  const pages = tenant.pages ?? {};
  const on = tenant.brand.pages;
  const About = pages.about ? lazyComponent(pages.about) : null;
  const Branches = pages.branches ? lazyComponent(pages.branches) : BranchesPage;
  const Contact = pages.contact ? lazyComponent(pages.contact) : ContactPage;
  return [
    ...(on.about && About ? [{ path: '/about', element: <About /> }] : []),
    ...(on.branches
      ? [
          { path: '/branches', element: <Branches /> },
          {
            path: '/admin/branches',
            element: (
              <RequireRole roles={['ADMIN']}>
                <BranchesAdminPage />
              </RequireRole>
            ),
          },
        ]
      : []),
    ...(on.contact
      ? [
          { path: '/contact', element: <Contact /> },
          {
            path: '/admin/messages',
            element: (
              <RequireRole roles={['ADMIN']}>
                <MessagesPage />
              </RequireRole>
            ),
          },
        ]
      : []),
  ];
}

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
      ...sitePages(),
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
