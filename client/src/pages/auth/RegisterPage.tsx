import { type FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { homeFor, useAuth } from '../../features/auth/authStore';
import { safeReturnTo } from '../../features/auth/returnTo';
import { ApiError } from '../../shared/api/client';
import { buttonClass } from '../../shared/ui/buttonClass';
import { Field } from '../../shared/ui/Field';
import { formValue } from '../../shared/ui/formValue';

export function RegisterPage() {
  const register = useAuth((s) => s.register);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = safeReturnTo(params.get('returnTo'));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      const user = await register({
        name: formValue(form, 'name'),
        email: formValue(form, 'email'),
        password: formValue(form, 'password'),
      });
      navigate(returnTo ?? homeFor(user.role), { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') {
        const fields = (err.details?.fieldErrors ?? {}) as Record<string, string[]>;
        setErrors(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v[0] ?? ''])));
      } else {
        setFormError(err instanceof ApiError ? err.message : 'Sign-up failed. Try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col px-5 py-12">
      <div className="rounded-card border border-line bg-surface p-7 shadow-dish">
        <h1 className="font-display text-3xl font-bold">Create your account</h1>
        <p className="mt-1 text-sm text-ink-muted">Order from any table and track it live.</p>
        <form className="mt-6 flex flex-col gap-4" onSubmit={(e) => void onSubmit(e)}>
          <Field label="Name" name="name" autoComplete="name" required error={errors.name} />
          <Field
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
            error={errors.email}
          />
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            error={errors.password}
          />
          {formError && (
            <p role="alert" className="text-sm text-flame-text">
              {formError}
            </p>
          )}
          <button type="submit" className={buttonClass('primary', 'lg')} disabled={busy}>
            {busy ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-ink-muted">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-flame-text hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
