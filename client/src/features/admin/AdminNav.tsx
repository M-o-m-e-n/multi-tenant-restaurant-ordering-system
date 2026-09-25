import { NavLink } from 'react-router-dom';

const links = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/reports', label: 'Reports', end: false },
  { to: '/admin/menu', label: 'Menu', end: false },
  { to: '/pos/tables', label: 'Tables', end: false },
];

/** Section navigation for the admin area. */
export function AdminNav() {
  return (
    <nav aria-label="Admin" className="flex flex-wrap gap-2">
      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          className={({ isActive }) =>
            `inline-flex min-h-11 items-center rounded-btn border px-4 text-sm font-semibold ${isActive ? 'border-flame bg-flame text-white' : 'border-line-strong bg-surface-raised text-ink hover:border-ink-muted'}`
          }
        >
          {l.label}
        </NavLink>
      ))}
    </nav>
  );
}
