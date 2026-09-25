import { Link, NavLink } from 'react-router-dom';

import { buttonClass } from './buttonClass';
import { Logo } from './Logo';

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/menu', label: 'Menu', end: false },
];

export function NavBar() {
  return (
    <header className="mx-auto flex w-full max-w-content items-center justify-between gap-4 px-5 py-5 md:px-8">
      <Link to="/" aria-label="Fork and Flame home">
        <Logo />
      </Link>
      <nav aria-label="Main" className="hidden gap-7 md:flex">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) =>
              `text-sm ${isActive ? 'font-semibold text-ink' : 'font-medium text-ink/90 hover:text-flame-text'}`
            }
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
      <div className="flex items-center gap-3">
        <Link to="/login" className={buttonClass('primary')}>
          Sign In
        </Link>
      </div>
    </header>
  );
}
