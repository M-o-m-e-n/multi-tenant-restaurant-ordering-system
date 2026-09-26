import { type FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { homeFor, useAuth } from '../../features/auth/authStore';
import { safeReturnTo } from '../../features/auth/returnTo';
import { useT } from '../../i18n';
import { errorMessage } from '../../shared/api/errorMessage';
import { buttonClass } from '../../shared/ui/buttonClass';
import { Field } from '../../shared/ui/Field';
import { formValue } from '../../shared/ui/formValue';

export function LoginPage() {
  const login = useAuth((s) => s.login);
  const endedBecause = useAuth((s) => s.endedBecause);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = safeReturnTo(params.get('returnTo'));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const t = useT();
  const ended = t.auth.ended as Readonly<Record<string, string>>;

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
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col px-5 py-12">
      <div className="rounded-card border border-line bg-surface p-7 shadow-dish">
        <h1 className="font-display text-3xl font-bold">{t.auth.welcome}</h1>
        <p className="mt-1 text-sm text-ink-muted">{t.auth.signInHint}</p>
        {endedBecause && ended[endedBecause] && (
          <p role="alert" className="mt-4 rounded-icon border border-line-strong p-3 text-sm">
            {ended[endedBecause]}
          </p>
        )}
        <form className="mt-6 flex flex-col gap-4" onSubmit={(e) => void onSubmit(e)}>
          <Field label={t.auth.email} name="email" type="email" autoComplete="email" required />
          <Field
            label={t.auth.password}
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
            {busy ? t.auth.signingIn : t.auth.signIn}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-ink-muted">
          {t.auth.newHere}{' '}
          <Link
            to={`/register${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`}
            className="font-semibold text-flame-text hover:underline"
          >
            {t.auth.createAccount}
          </Link>
        </p>
      </div>
    </main>
  );
}
