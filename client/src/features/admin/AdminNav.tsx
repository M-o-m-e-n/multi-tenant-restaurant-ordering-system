import { NavLink } from 'react-router-dom';

import { brand } from '../../brand';
import { useT } from '../../i18n';
import { useUnreadCount } from '../contact/contactApi';

type Label = 'dashboard' | 'reports' | 'menu' | 'tables' | 'branches' | 'messages';

const links: { to: string; label: Label; end: boolean }[] = [
  { to: '/admin', label: 'dashboard', end: true },
  { to: '/admin/reports', label: 'reports', end: false },
  { to: '/admin/menu', label: 'menu', end: false },
  { to: '/pos/tables', label: 'tables', end: false },
  ...(brand.pages.branches
    ? [{ to: '/admin/branches', label: 'branches' as const, end: false }]
    : []),
  ...(brand.pages.contact
    ? [{ to: '/admin/messages', label: 'messages' as const, end: false }]
    : []),
];

/** Section navigation for the admin area; Messages carries the unread count. */
export function AdminNav() {
  const t = useT();
  const { data: unread = 0 } = useUnreadCount(brand.pages.contact);
  return (
    <nav aria-label={t.admin.nav} className="flex flex-wrap gap-2">
      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          className={({ isActive }) =>
            `inline-flex min-h-11 items-center gap-2 rounded-btn border px-4 text-sm font-semibold ${isActive ? 'border-flame bg-flame text-white' : 'border-line-strong bg-surface-raised text-ink hover:border-ink-muted'}`
          }
        >
          {t.admin[l.label]}
          {l.label === 'messages' && unread > 0 && (
            <span
              aria-label={t.admin.unread(unread)}
              className="grid min-w-5 place-items-center rounded-full bg-ink px-1.5 text-[0.7rem] font-bold text-ink-inverse"
            >
              {unread}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
