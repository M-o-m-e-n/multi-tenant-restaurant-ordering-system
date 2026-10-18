import type { BranchDto } from '@ros/shared';

import { useLang, useT } from '../../i18n';
import { buttonClass } from '../../shared/ui/buttonClass';
import { hoursRange } from '../landing/openHours';
import { directionsUrl, embedUrl, localPhone, whatsappUrl } from './maps';
import { OpenChip } from './OpenChip';

/**
 * The keyless Google Maps embed (ADR-032): no API key, no cost, loaded only
 * when it scrolls near the screen.
 */
export function BranchMap({ branch, className = '' }: { branch: BranchDto; className?: string }) {
  const lang = useLang();
  const t = useT();
  if (!branch.position) {
    return (
      <div
        className={`grid place-items-center bg-surface-raised p-6 text-center text-sm text-ink-muted ${className}`}
      >
        {t.branches.noPin}
      </div>
    );
  }
  return (
    <iframe
      title={t.branches.map(branch.name[lang])}
      src={embedUrl(branch.position, lang)}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      className={`w-full border-0 bg-surface-raised ${className}`}
    />
  );
}

/** Today's weekday on the restaurant clock, 0 = Sunday. */
function weekday(timeZone: string): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(new Date());
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name);
}

interface Props {
  branch: BranchDto;
  timeZone: string;
  /** Set when the guest asked for the nearest branch and this is it. */
  nearestKm?: number | null;
}

/** One branch: map, open-now chip, address, today's hours, and call / directions / WhatsApp. */
export function BranchCard({ branch, timeZone, nearestKm = null }: Props) {
  const lang = useLang();
  const t = useT();
  const today = branch.hours[weekday(timeZone)] ?? null;
  const name = branch.name[lang];
  return (
    <article
      aria-labelledby={`branch-${branch.slug}`}
      className={`spotlight flex flex-col overflow-hidden rounded-frame border bg-surface transition-shadow duration-500 ${nearestKm !== null ? 'border-flame shadow-glow' : 'border-line'}`}
    >
      <BranchMap branch={branch} className="aspect-[16/10]" />
      <div className="flex flex-1 flex-col p-6 md:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <OpenChip week={branch.hours} />
          {nearestKm !== null && (
            <span className="rounded-btn bg-flame px-3 py-1 text-xs font-semibold text-white">
              {t.branches.nearest} · {t.branches.away(nearestKm.toFixed(1))}
            </span>
          )}
        </div>
        <h3 id={`branch-${branch.slug}`} className="mt-4 font-display text-2xl font-bold">
          {name}
        </h3>
        <address className="mt-2 not-italic text-ink-muted">{branch.address[lang]}</address>
        {branch.features.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {branch.features.map((f) => (
              <li
                key={f}
                className="rounded-btn border border-line-strong px-3 py-1 text-xs text-ink-muted"
              >
                {t.branches.feature[f] ?? f}
              </li>
            ))}
          </ul>
        )}
        <dl className="mt-5 divide-y divide-line border-y border-line text-sm">
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-ink-muted">{t.branches.today}</dt>
            <dd className="tabular font-medium">
              {hoursRange(today, lang) ?? t.branches.closedDay}
            </dd>
          </div>
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-ink-muted">{t.contact.phones}</dt>
            <dd className="flex flex-col items-end gap-1">
              {branch.phones.map((p) => (
                <a
                  key={p}
                  href={`tel:${p}`}
                  dir="ltr"
                  aria-label={t.branches.callNumber(localPhone(p))}
                  className="tabular font-medium text-flame-text hover:underline"
                >
                  {localPhone(p)}
                </a>
              ))}
            </dd>
          </div>
        </dl>
        <div className="mt-6 flex flex-wrap gap-3">
          {branch.position && (
            <a
              href={directionsUrl(branch.position)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass('primary')}
            >
              {t.branches.directions}
            </a>
          )}
          {branch.phones[0] && (
            <a href={`tel:${branch.phones[0]}`} className={buttonClass('secondary')}>
              {t.branches.call}
            </a>
          )}
          {branch.whatsapp && (
            <a
              href={whatsappUrl(branch.whatsapp)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass('ghost')}
            >
              {t.branches.whatsapp}
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
