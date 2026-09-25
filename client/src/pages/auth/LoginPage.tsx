import { type FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { homeFor, useAuth } from '../../features/auth/authStore';
import { safeReturnTo } from '../../features/auth/returnTo';
import { ApiError } from '../../shared/api/client';
import { buttonClass } from '../../shared/ui/buttonClass';
import { Field } from '../../shared/ui/Field';
import { formValue } from '../../shared/ui/formValue';

const ENDED: Record<string, string> = {
  SESSION_REVOKED: 'For your safety your session was ended on every device. Sign in again.',
  SESSION_EXPIRED: 'Your session expired. Sign in again.',
  ACCOUNT_DISABLED: 'This account has been disabled. Ask an admin.',
};

export function LoginPage() {
  const login = useAuth((s) => s.login);
  const endedBecause = useAuth((s) => s.endedBecause);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = safeReturnTo(params.get('returnTo'));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const user = await login({
        email: formValue(form, 'email'),
        password: formValue(form, 'password'),
      });
      navigate(returnTo ?? homeFor(user.role), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign-in failed. Check your connection.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col px-5 py-12">
      <div className="rounded-card border border-line bg-surface p-7 shadow-dish">
        <h1 className="font-display text-3xl font-bold">Welcome back</h1>
        <p className="mt-1 text-sm text-ink-muted">Sign in to order, track and pay.</p>
        {endedBecause && ENDED[endedBecause] && (
          <p role="alert" className="mt-4 rounded-icon border border-line-strong p-3 text-sm">
            {ENDED[endedBecause]}
          </p>
        )}
        <form className="mt-6 flex flex-col gap-4" onSubmit={(e) => void onSubmit(e)}>
          <Field label="Email" name="email" type="email" autoComplete="email" required />
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          {error && (
            <p role="alert" className="text-sm text-flame-text">
              {error}
            </p>
          )}
          <button type="submit" className={buttonClass('primary', 'lg')} disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-ink-muted">
          New here?{' '}
          <Link
            to={`/register${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`}
            className="font-semibold text-flame-text hover:underline"
          >
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
