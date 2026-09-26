import { NavLink } from 'react-router-dom';

import { useT } from '../../i18n';

const links = [
  { to: '/admin', label: 'dashboard', end: true },
  { to: '/admin/reports', label: 'reports', end: false },
  { to: '/admin/menu', label: 'menu', end: false },
  { to: '/pos/tables', label: 'tables', end: false },
] as const;

/** Section navigation for the admin area. */
export function AdminNav() {
  const t = useT();
  return (
    <nav aria-label={t.admin.nav} className="flex flex-wrap gap-2">
      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          className={({ isActive }) =>
            `inline-flex min-h-11 items-center rounded-btn border px-4 text-sm font-semibold ${isActive ? 'border-flame bg-flame text-white' : 'border-line-strong bg-surface-raised text-ink hover:border-ink-muted'}`
          }
        >
          {t.admin[l.label]}
        </NavLink>
      ))}
    </nav>
  );
}
