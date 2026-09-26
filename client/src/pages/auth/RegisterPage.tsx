import { type FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { homeFor, useAuth } from '../../features/auth/authStore';
import { safeReturnTo } from '../../features/auth/returnTo';
import { useLang, useT } from '../../i18n';
import { ApiError } from '../../shared/api/client';
import { errorMessage } from '../../shared/api/errorMessage';
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
  const t = useT();
  const lang = useLang();

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
        // English keeps the server's own wording; other languages get the field's line.
        const localized = t.auth.field as Readonly<Record<string, string>>;
        setErrors(
          Object.fromEntries(
            Object.entries(fields).map(([k, v]) => [
              k,
              lang === 'en' ? (v[0] ?? '') : (localized[k] ?? t.errors.VALIDATION_ERROR),
            ]),
          ),
        );
      } else {
        setFormError(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col px-5 py-12">
      <div className="rounded-card border border-line bg-surface p-7 shadow-dish">
        <h1 className="font-display text-3xl font-bold">{t.auth.registerTitle}</h1>
        <p className="mt-1 text-sm text-ink-muted">{t.auth.registerHint}</p>
        <form className="mt-6 flex flex-col gap-4" onSubmit={(e) => void onSubmit(e)}>
          <Field label={t.auth.name} name="name" autoComplete="name" required error={errors.name} />
          <Field
            label={t.auth.email}
            name="email"
            type="email"
            autoComplete="email"
            required
            error={errors.email}
          />
          <Field
            label={t.auth.password}
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
            {busy ? t.auth.creating : t.auth.create}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-ink-muted">
          {t.auth.haveAccount}{' '}
          <Link to="/login" className="font-semibold text-flame-text hover:underline">
            {t.auth.signIn}
          </Link>
        </p>
      </div>
    </main>
  );
}
