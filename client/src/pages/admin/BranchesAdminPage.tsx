import { type BranchDto, updateBranchSchema } from '@ros/shared';
import { type FormEvent, useId, useState } from 'react';

import { AdminNav } from '../../features/admin/AdminNav';
import { useAdminBranches, useUpdateBranch } from '../../features/branches/branchesApi';
import {
  directionsUrl,
  type LatLng,
  localPhone,
  parseMapsLink,
} from '../../features/branches/maps';
import { PinMap } from '../../features/branches/PinMap';
import { hourLabel } from '../../features/landing/openHours';
import { useLang, useT } from '../../i18n';
import { errorMessage } from '../../shared/api/errorMessage';
import { buttonClass } from '../../shared/ui/buttonClass';
import { Field } from '../../shared/ui/Field';
import { formValue } from '../../shared/ui/formValue';
import { toast } from '../../shared/ui/toastStore';

const labelClass = 'text-xs font-medium uppercase tracking-wider text-ink-muted';
const inputClass =
  'min-h-11 rounded-icon border border-line-strong bg-bg px-3 text-sm text-ink focus:border-flame-light';

const OPEN_HOURS = Array.from({ length: 24 }, (_, h) => h);
/** Closing may run past midnight, up to 6 am. */
const CLOSE_HOURS = Array.from({ length: 30 }, (_, h) => h + 1);

function BranchEditor({ branch }: { branch: BranchDto }) {
  const t = useT();
  const lang = useLang();
  const id = useId();
  const update = useUpdateBranch();
  const [position, setPosition] = useState<LatLng | null>(branch.position);
  const [pasteError, setPasteError] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const first = branch.hours.find((h) => h !== null) ?? { open: 11, close: 26 };
  const [open, setOpen] = useState(first.open);
  const [close, setClose] = useState(first.close);
  const name = branch.name[lang];

  const applyPasted = (text: string) => {
    const p = parseMapsLink(text);
    setPasteError(!p);
    if (p) setPosition(p);
  };

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const phones = formValue(data, 'phones')
      .split(/[\n,]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    const whatsapp = formValue(data, 'whatsapp').trim();
    const body = {
      addressAr: formValue(data, 'addressAr').trim(),
      addressEn: formValue(data, 'addressEn').trim(),
      phones,
      whatsapp: whatsapp || null,
      hours: Array.from({ length: 7 }, () => ({ open, close })),
      isActive: data.get('isActive') === 'on',
      ...(position ? { lat: position.lat, lng: position.lng } : {}),
    };
    const check = updateBranchSchema.safeParse(body);
    if (!check.success) {
      setFailure(t.errors.VALIDATION_ERROR);
      return;
    }
    setFailure(null);
    try {
      await update.mutateAsync({ id: branch.id, body: check.data });
      toast({ title: t.branchesAdmin.saved(name) });
    } catch (err) {
      setFailure(errorMessage(err));
    }
  };

  return (
    <form
      onSubmit={(e) => void save(e)}
      aria-labelledby={`${id}-title`}
      className="rounded-card border border-line bg-surface p-5 md:p-6"
    >
      <h2 id={`${id}-title`} className="font-display text-2xl font-bold">
        {name}
      </h2>
      <div className="mt-4 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-muted">{t.branchesAdmin.pinHint}</p>
          <PinMap value={position} onChange={setPosition} label={t.branchesAdmin.mapLabel(name)} />
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="tabular text-ink-muted" dir="ltr">
              {position
                ? t.branchesAdmin.position(position.lat.toFixed(6), position.lng.toFixed(6))
                : t.branchesAdmin.noPosition}
            </span>
            {position && (
              <a
                href={directionsUrl(position)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-flame-text hover:underline"
              >
                {t.branchesAdmin.check}
              </a>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-paste`} className={labelClass}>
              {t.branchesAdmin.paste}
            </label>
            <div className="flex gap-2">
              <input
                id={`${id}-paste`}
                dir="ltr"
                inputMode="url"
                aria-describedby={`${id}-paste-hint`}
                aria-invalid={pasteError || undefined}
                className={`${inputClass} flex-1`}
                onPaste={(e) => applyPasted(e.clipboardData.getData('text'))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyPasted(e.currentTarget.value);
                  }
                }}
              />
              <button
                type="button"
                className={buttonClass('ghost')}
                onClick={(e) => {
                  const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                  applyPasted(input.value);
                }}
              >
                {t.branchesAdmin.usePasted}
              </button>
            </div>
            <p
              id={`${id}-paste-hint`}
              className={`text-xs ${pasteError ? 'text-flame-text' : 'text-ink-muted'}`}
            >
              {pasteError ? t.branchesAdmin.pasteBad : t.branchesAdmin.pasteHint}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Field
            label={t.branchesAdmin.addressAr}
            name="addressAr"
            dir="rtl"
            defaultValue={branch.address.ar}
            required
          />
          <Field
            label={t.branchesAdmin.addressEn}
            name="addressEn"
            dir="ltr"
            defaultValue={branch.address.en}
            required
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-phones`} className={labelClass}>
              {t.branchesAdmin.phones}
            </label>
            <textarea
              id={`${id}-phones`}
              name="phones"
              dir="ltr"
              rows={3}
              defaultValue={branch.phones.map(localPhone).join('\n')}
              className={`${inputClass} py-2`}
            />
          </div>
          <Field
            label={t.branchesAdmin.whatsapp}
            name="whatsapp"
            type="tel"
            dir="ltr"
            defaultValue={branch.whatsapp ? localPhone(branch.whatsapp) : ''}
          />
          <fieldset>
            <legend className={labelClass}>{t.branches.hours}</legend>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm text-ink-muted">
                {t.branchesAdmin.opens}
                <select
                  value={open}
                  onChange={(e) => setOpen(Number(e.target.value))}
                  className={inputClass}
                >
                  {OPEN_HOURS.map((h) => (
                    <option key={h} value={h}>
                      {hourLabel(h, lang)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm text-ink-muted">
                {t.branchesAdmin.closes}
                <select
                  value={close}
                  onChange={(e) => setClose(Number(e.target.value))}
                  className={inputClass}
                >
                  {CLOSE_HOURS.filter((h) => h > open).map((h) => (
                    <option key={h} value={h}>
                      {hourLabel(h, lang)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="mt-2 text-xs text-ink-muted">{t.branchesAdmin.hoursNote}</p>
          </fieldset>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={branch.isActive}
              className="size-5 accent-flame"
            />
            {t.branchesAdmin.active}
          </label>
          {failure && (
            <p role="alert" className="text-sm text-flame-text">
              {failure}
            </p>
          )}
          <button type="submit" disabled={update.isPending} className={buttonClass('primary')}>
            {update.isPending ? t.branchesAdmin.saving : t.branchesAdmin.save}
          </button>
        </div>
      </div>
    </form>
  );
}

/** Admin: each branch's details, hours and exact map pin (ADR-032). */
export function BranchesAdminPage() {
  const t = useT();
  const { data, isLoading } = useAdminBranches();
  return (
    <main className="mx-auto w-full max-w-content px-5 pb-20 md:px-10">
      <div className="mb-4">
        <AdminNav />
      </div>
      <h1 className="font-display text-3xl font-bold">{t.branchesAdmin.title}</h1>
      <p className="mt-1 text-sm text-ink-muted">{t.branchesAdmin.lead}</p>
      {isLoading || !data ? (
        <p role="status" className="p-10 text-center text-ink-muted">
          {t.branches.loading}
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          {data.map((b) => (
            <BranchEditor key={b.id} branch={b} />
          ))}
        </div>
      )}
    </main>
  );
}
