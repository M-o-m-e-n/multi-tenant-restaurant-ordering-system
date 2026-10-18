import {
  type BranchDto,
  CONTACT_KINDS,
  type ContactKind,
  createContactMessageSchema,
} from '@ros/shared';
import { type FormEvent, useId, useState } from 'react';

import { useLang, useT } from '../../i18n';
import { errorMessage } from '../../shared/api/errorMessage';
import { buttonClass } from '../../shared/ui/buttonClass';
import { Field } from '../../shared/ui/Field';
import { formValue } from '../../shared/ui/formValue';
import { useSendMessage } from './contactApi';

type FieldName = 'name' | 'phone' | 'message';

const labelClass = 'text-xs font-medium uppercase tracking-wider text-ink-muted';
const inputClass =
  'min-h-11 rounded-icon border border-line-strong bg-bg px-3 text-sm text-ink focus:border-flame-light';

/**
 * The complaints-and-suggestions form, mirroring the one on the restaurant's
 * current site (ADR-032). The shared schema checks it before it is sent and
 * the server checks it again; messages land in the admin inbox.
 */
export function ContactForm({ branches }: { branches: readonly BranchDto[] }) {
  const t = useT();
  const lang = useLang();
  const id = useId();
  const send = useSendMessage();
  const [kind, setKind] = useState<ContactKind>('SUGGESTION');
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const v = (name: string) => formValue(data, name).trim();
    const dto = {
      name: v('name'),
      phone: v('phone'),
      kind,
      message: v('message'),
      ...(v('branchId') ? { branchId: v('branchId') } : {}),
      ...(v('tableNumber') ? { tableNumber: v('tableNumber') } : {}),
      ...(v('visitDate') ? { visitDate: v('visitDate') } : {}),
    };
    const check = createContactMessageSchema.safeParse(dto);
    if (!check.success) {
      const next: Partial<Record<FieldName, string>> = {};
      for (const issue of check.error.issues) {
        const field = issue.path[0];
        if (field === 'name') next.name = t.checkout.field.name;
        if (field === 'phone') next.phone = t.checkout.field.phone;
        if (field === 'message') next.message = t.contact.tooShort;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setFailure(null);
    try {
      await send.mutateAsync(check.data);
      form.reset();
      setSent(true);
    } catch (err) {
      setFailure(errorMessage(err));
    }
  };

  if (sent) {
    return (
      <div role="status" className="rounded-card border border-line bg-surface p-8 text-center">
        <p className="mx-auto grid size-14 place-items-center rounded-full bg-flame text-2xl text-white shadow-glow motion-safe:animate-pop">
          <span aria-hidden="true">✓</span>
        </p>
        <p className="mt-4 font-display text-2xl font-bold">{t.contact.sentTitle}</p>
        <p className="mt-2 text-ink-muted">{t.contact.sentBody}</p>
        <button
          type="button"
          className={`${buttonClass('ghost')} mt-6`}
          onClick={() => setSent(false)}
        >
          {t.contact.another}
        </button>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(e) => void submit(e)}
      className="grid gap-4 rounded-card border border-line bg-surface p-6 md:grid-cols-2 md:p-8"
    >
      <fieldset className="md:col-span-2">
        <legend className={labelClass}>{t.contact.kind}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {CONTACT_KINDS.map((k) => (
            <label
              key={k}
              className={`inline-flex min-h-11 cursor-pointer items-center rounded-btn border px-5 text-sm font-semibold transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-flame-light ${kind === k ? 'border-flame bg-flame text-white' : 'border-line-strong bg-surface-raised text-ink hover:border-ink-muted'}`}
            >
              <input
                type="radio"
                name="kind"
                value={k}
                checked={kind === k}
                onChange={() => setKind(k)}
                className="sr-only"
              />
              {t.contact.kinds[k]}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label={t.contact.name} name="name" autoComplete="name" required error={errors.name} />
      <Field
        label={t.contact.phone}
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        dir="ltr"
        required
        error={errors.phone}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-branch`} className={labelClass}>
          {t.contact.branch}
        </label>
        <select id={`${id}-branch`} name="branchId" defaultValue="" className={inputClass}>
          <option value="">{t.contact.anyBranch}</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name[lang]}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field
          label={`${t.contact.table} ${t.contact.optional}`}
          name="tableNumber"
          inputMode="numeric"
          maxLength={10}
        />
        <Field
          label={`${t.contact.visitDate} ${t.contact.optional}`}
          name="visitDate"
          type="date"
        />
      </div>
      <div className="flex flex-col gap-1.5 md:col-span-2">
        <label htmlFor={`${id}-message`} className={labelClass}>
          {t.contact.message}
        </label>
        <textarea
          id={`${id}-message`}
          name="message"
          rows={5}
          maxLength={1000}
          required
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={errors.message ? `${id}-message-error` : undefined}
          className={`${inputClass} py-3`}
        />
        {errors.message && (
          <p id={`${id}-message-error`} className="text-xs text-flame-text">
            {errors.message}
          </p>
        )}
      </div>
      {failure && (
        <p role="alert" className="text-sm text-flame-text md:col-span-2">
          {failure}
        </p>
      )}
      <div className="md:col-span-2">
        <button
          type="submit"
          disabled={send.isPending}
          className={`${buttonClass('primary', 'lg')} w-full sm:w-auto`}
        >
          {send.isPending ? t.contact.sending : t.contact.send}
        </button>
      </div>
    </form>
  );
}
