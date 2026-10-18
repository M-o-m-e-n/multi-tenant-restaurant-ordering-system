import { CONTACT_KINDS, type ContactKind } from '@ros/shared';
import { useState } from 'react';

import { AdminNav } from '../../features/admin/AdminNav';
import { localPhone } from '../../features/branches/maps';
import { useMarkMessage, useMessages } from '../../features/contact/contactApi';
import { useLang, useT } from '../../i18n';
import { formatDateTime, formatLongDate } from '../../shared/format';
import { buttonClass } from '../../shared/ui/buttonClass';

const PAGE = 25;

const chip = (active: boolean) =>
  `inline-flex min-h-11 items-center rounded-btn border px-4 text-sm font-semibold ${active ? 'border-flame bg-flame text-white' : 'border-line-strong bg-surface-raised text-ink hover:border-ink-muted'}`;

/** Admin: the contact-page inbox, newest first, unread marked in words (ADR-032). */
export function MessagesPage() {
  const t = useT();
  const lang = useLang();
  const [unread, setUnread] = useState(false);
  const [kind, setKind] = useState<ContactKind | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const { data, isLoading } = useMessages({ unread, kind, limit });
  const mark = useMarkMessage();

  return (
    <main className="mx-auto w-full max-w-content px-5 pb-20 md:px-10">
      <div className="mb-4">
        <AdminNav />
      </div>
      <h1 className="font-display text-3xl font-bold">{t.messagesAdmin.title}</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {t.messagesAdmin.lead}
        {data ? ` · ${t.admin.unread(data.unread)}` : ''}
      </p>

      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label={t.messagesAdmin.title}>
        <button
          type="button"
          aria-pressed={!unread}
          className={chip(!unread)}
          onClick={() => setUnread(false)}
        >
          {t.messagesAdmin.all}
        </button>
        <button
          type="button"
          aria-pressed={unread}
          className={chip(unread)}
          onClick={() => setUnread(true)}
        >
          {t.messagesAdmin.unreadOnly}
        </button>
        <span className="mx-1 w-px self-stretch bg-line" aria-hidden="true" />
        <button
          type="button"
          aria-pressed={kind === null}
          className={chip(kind === null)}
          onClick={() => setKind(null)}
        >
          {t.messagesAdmin.allKinds}
        </button>
        {CONTACT_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            className={chip(kind === k)}
            onClick={() => setKind(k)}
          >
            {t.contact.kinds[k]}
          </button>
        ))}
      </div>

      {isLoading || !data ? (
        <p role="status" className="p-10 text-center text-ink-muted">
          {t.messagesAdmin.loading}
        </p>
      ) : data.data.length === 0 ? (
        <p className="p-10 text-center text-ink-muted">{t.messagesAdmin.empty}</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {data.data.map((m) => {
            const isUnread = m.readAt === null;
            return (
              <li
                key={m.id}
                className={`rounded-card border bg-surface p-5 ${isUnread ? 'border-flame/70' : 'border-line'}`}
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {isUnread && (
                    <span className="rounded-btn bg-flame px-2.5 py-0.5 font-semibold text-white">
                      {t.messagesAdmin.unreadTag}
                    </span>
                  )}
                  <span className="rounded-btn border border-line-strong px-2.5 py-0.5 font-semibold">
                    {t.contact.kinds[m.kind]}
                  </span>
                  {m.branch && <span className="text-ink-muted">{m.branch.name[lang]}</span>}
                  {m.tableNumber && (
                    <span className="text-ink-muted">· {t.messagesAdmin.table(m.tableNumber)}</span>
                  )}
                  {m.visitDate && (
                    <span className="text-ink-muted">
                      · {t.messagesAdmin.visited(formatLongDate(`${m.visitDate}T12:00:00Z`))}
                    </span>
                  )}
                  <span className="ms-auto text-ink-muted">
                    {t.messagesAdmin.received(formatDateTime(m.createdAt))}
                  </span>
                </div>
                <p dir="auto" className="mt-3 whitespace-pre-line text-base">
                  {m.message}
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm">
                    <span dir="auto" className="font-semibold">
                      {m.name}
                    </span>{' '}
                    <a
                      href={`tel:${m.phone}`}
                      dir="ltr"
                      aria-label={t.messagesAdmin.callBack(localPhone(m.phone))}
                      className="tabular text-flame-text hover:underline"
                    >
                      {localPhone(m.phone)}
                    </a>
                  </p>
                  <button
                    type="button"
                    disabled={mark.isPending}
                    className={buttonClass('ghost', 'sm')}
                    onClick={() => mark.mutate({ id: m.id, read: isUnread })}
                  >
                    {isUnread ? t.messagesAdmin.markRead : t.messagesAdmin.markUnread}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {data && limit < 100 && data.meta.total > data.data.length && (
        <div className="mt-6 text-center">
          <button
            type="button"
            className={buttonClass('ghost')}
            onClick={() => setLimit((n) => Math.min(n + PAGE, 100))}
          >
            {t.messagesAdmin.more}
          </button>
        </div>
      )}
    </main>
  );
}
