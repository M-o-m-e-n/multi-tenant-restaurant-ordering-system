import type { Role } from '@ros/shared';
import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';

import { buttonClass } from '../../shared/ui/buttonClass';
import { useAuth } from './authStore';

/**
 * Route guard (LLD §7.1). Signed out → /login with a returnTo, so a deep link
 * lands back where it started. Wrong role → an explanation, not a redirect loop.
 */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'unknown') {
    return (
      <p role="status" className="p-10 text-center text-ink-muted">
        Checking your session…
      </p>
    );
  }
  if (status === 'anonymous' || !user) {
    const returnTo = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }
  if (!roles.includes(user.role)) {
    return (
      <main className="mx-auto max-w-content px-5 py-16 text-center">
        <h1 className="font-display text-3xl font-bold">This area is for staff</h1>
        <p className="mt-3 text-ink-muted">
          You are signed in as {user.name}, who cannot open this page.
        </p>
        <Link to="/" className={`${buttonClass('ghost')} mt-6`}>
          Back to the menu
        </Link>
      </main>
    );
  }
  return <>{children}</>;
}
