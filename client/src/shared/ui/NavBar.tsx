import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../../features/auth/authStore';
import { cartCount, useCart } from '../../features/cart/cartStore';
import { CartIcon } from '../../features/menu/DishCard';
import { buttonClass } from './buttonClass';
import { Logo } from './Logo';

const links = [
  { to: '/', label: 'Home', end: true, roles: null },
  { to: '/menu', label: 'Menu', end: false, roles: null },
  { to: '/reserve', label: 'Book', end: false, roles: ['CUSTOMER'] },
  { to: '/orders', label: 'My orders', end: false, roles: ['CUSTOMER'] },
  { to: '/kitchen', label: 'Kitchen', end: false, roles: ['STAFF', 'ADMIN'] },
  { to: '/pos', label: 'POS', end: true, roles: ['STAFF', 'ADMIN'] },
  { to: '/pos/tables', label: 'Tables', end: false, roles: ['STAFF', 'ADMIN'] },
  { to: '/pos/reservations', label: 'Bookings', end: false, roles: ['STAFF', 'ADMIN'] },
  { to: '/admin', label: 'Admin', end: false, roles: ['ADMIN'] },
] as const;

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `nav-link text-sm ${isActive ? 'is-active font-semibold text-ink' : 'font-medium text-ink/90 hover:text-ink'}`;

/** Top navigation. `compact` tightens it once the page scrolls under it. */
export function NavBar({ compact = false }: { compact?: boolean }) {
  const { status, user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  // Any navigation closes the mobile menu.
  useEffect(() => setMenuOpen(false), [pathname]);
  const count = useCart((s) => cartCount(s.lines));
  const visible = links.filter(
    (l) => l.roles === null || (user && (l.roles as readonly string[]).includes(user.role)),
  );

  return (
    <header
      className={`relative mx-auto flex w-full max-w-content items-center justify-between gap-4 px-5 transition-[padding] duration-300 md:px-8 ${compact ? 'py-2.5' : 'py-5'}`}
    >
      <Link to="/" aria-label="Fork and Flame home">
        <Logo />
      </Link>
      <nav aria-label="Main" className="hidden gap-7 md:flex">
        {visible.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
            {l.label}
          </NavLink>
        ))}
      </nav>
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen((o) => !o)}
          className="grid size-11 place-items-center rounded-full text-ink transition hover:bg-surface-raised md:hidden"
        >
          <span className={`burger ${menuOpen ? 'is-open' : ''}`} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
        <Link
          to="/cart"
          data-cart-target
          aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`}
          className="relative grid size-11 place-items-center rounded-full text-ink transition hover:bg-surface-raised active:scale-90"
        >
          <CartIcon className="size-6" />
          {count > 0 && (
            <span
              key={count}
              className="absolute right-0.5 top-0.5 grid min-w-5 place-items-center rounded-full bg-flame px-1 text-[0.65rem] font-bold text-white motion-safe:animate-pop"
            >
              {count}
            </span>
          )}
        </Link>
        {/* On phones the account action lives in the menu sheet instead. */}
        {status === 'authenticated' && user ? (
          <div className="hidden items-center gap-3 sm:flex">
            <span className="text-sm text-ink-muted">{user.name}</span>
            <button
              type="button"
              className={buttonClass('ghost', 'sm')}
              onClick={() => {
                void logout().then(() => navigate('/'));
              }}
            >
              Sign out
            </button>
          </div>
        ) : (
          <Link to="/login" className={`${buttonClass('primary')} hidden sm:inline-flex`}>
            Sign In
          </Link>
        )}
      </div>
      {menuOpen && (
        <nav
          id="mobile-nav"
          aria-label="Main"
          className="mobile-sheet absolute inset-x-3 top-full z-50 mt-2 flex flex-col gap-1 rounded-card border border-line bg-surface/95 p-3 shadow-plate backdrop-blur-md md:hidden"
        >
          {visible.map((l, i) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              style={{ animationDelay: `${i * 35}ms` }}
              className={({ isActive }) =>
                `mobile-item flex min-h-12 items-center rounded-icon px-4 text-base ${isActive ? 'bg-flame font-semibold text-white' : 'text-ink hover:bg-surface-raised'}`
              }
            >
              {l.label}
            </NavLink>
          ))}
          <div className="mt-2 border-t border-line pt-3 sm:hidden">
            {status === 'authenticated' && user ? (
              <button
                type="button"
                className={`${buttonClass('ghost')} w-full`}
                onClick={() => {
                  void logout().then(() => navigate('/'));
                }}
              >
                Sign out · {user.name}
              </button>
            ) : (
              <Link to="/login" className={`${buttonClass('primary')} w-full`}>
                Sign In
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
