import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';

import { brand } from '../../brand';
import { useAuth } from '../../features/auth/authStore';
import { cartCount, useCart } from '../../features/cart/cartStore';
import { CartIcon } from '../../features/menu/DishCard';
import { type Messages, useLang, useT } from '../../i18n';
import { buttonClass } from './buttonClass';
import { LangToggle } from './LangToggle';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

// Site pages are for guests; staff screens need the room in the bar.
const GUESTS = ['GUEST', 'CUSTOMER'] as const;

const links: {
  to: string;
  label: keyof Messages['nav']['links'];
  end: boolean;
  /** null = everyone; GUEST = signed out, as well as customers. */
  roles: readonly string[] | null;
}[] = [
  { to: '/', label: 'home', end: true, roles: null },
  { to: '/menu', label: 'menu', end: false, roles: null },
  // Site pages, only for tenants that have them (ADR-032).
  ...(brand.pages.branches
    ? [{ to: '/branches', label: 'branches' as const, end: false, roles: GUESTS }]
    : []),
  ...(brand.pages.about
    ? [{ to: '/about', label: 'about' as const, end: false, roles: GUESTS }]
    : []),
  ...(brand.pages.contact
    ? [{ to: '/contact', label: 'contact' as const, end: false, roles: GUESTS }]
    : []),
  { to: '/reserve', label: 'book', end: false, roles: ['CUSTOMER'] },
  { to: '/orders', label: 'myOrders', end: false, roles: ['CUSTOMER'] },
  { to: '/kitchen', label: 'kitchen', end: false, roles: ['STAFF', 'ADMIN'] },
  { to: '/pos', label: 'pos', end: true, roles: ['STAFF', 'ADMIN'] },
  { to: '/pos/tables', label: 'tables', end: false, roles: ['STAFF', 'ADMIN'] },
  { to: '/pos/reservations', label: 'bookings', end: false, roles: ['STAFF', 'ADMIN'] },
  { to: '/admin', label: 'admin', end: false, roles: ['ADMIN'] },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `nav-link whitespace-nowrap text-sm ${isActive ? 'is-active font-semibold text-ink' : 'font-medium text-ink/90 hover:text-ink'}`;

/** Top navigation. `compact` tightens it once the page scrolls under it. */
export function NavBar({ compact = false }: { compact?: boolean }) {
  const { status, user, logout } = useAuth();
  const t = useT();
  const lang = useLang();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  // Any navigation closes the mobile menu.
  useEffect(() => setMenuOpen(false), [pathname]);
  const count = useCart((s) => cartCount(s.lines));
  const role = user?.role ?? 'GUEST';
  const visible = links.filter((l) => l.roles === null || l.roles.includes(role));
  // A long list of links needs a wider screen before it fits beside the logo and
  // the account buttons; until then it lives in the menu sheet, so nothing overlaps.
  const crowded = visible.length > 5;
  const inline = crowded ? 'hidden gap-6 xl:flex' : 'hidden gap-7 md:flex';
  const sheetOnly = crowded ? 'xl:hidden' : 'md:hidden';

  return (
    <header
      className={`relative mx-auto flex w-full max-w-[1320px] items-center justify-between gap-4 px-5 transition-[padding] duration-300 md:px-8 ${compact ? 'py-2.5' : 'py-5'}`}
    >
      <Link to="/" className="shrink-0" aria-label={`${brand.name[lang]} — ${t.nav.homeLabel}`}>
        <Logo />
      </Link>
      <nav aria-label={t.nav.main} className={inline}>
        {visible.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
            {t.nav.links[l.label]}
          </NavLink>
        ))}
      </nav>
      <div className="flex items-center gap-2 sm:gap-3">
        <LangToggle className="hidden sm:inline-flex" />
        {/* On phones the bar has no room for it; it moves into the menu sheet. */}
        <ThemeToggle className="hidden sm:grid" />
        <button
          type="button"
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          aria-label={menuOpen ? t.nav.closeMenu : t.nav.openMenu}
          onClick={() => setMenuOpen((o) => !o)}
          className={`grid size-11 place-items-center rounded-full text-ink transition hover:bg-surface-raised ${sheetOnly}`}
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
          aria-label={t.nav.cart(count)}
          className="relative grid size-11 place-items-center rounded-full text-ink transition hover:bg-surface-raised active:scale-90"
        >
          <CartIcon className="size-6" />
          {count > 0 && (
            <span
              key={count}
              className="absolute end-0.5 top-0.5 grid min-w-5 place-items-center rounded-full bg-flame px-1 text-[0.65rem] font-bold text-white motion-safe:animate-pop"
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
              {t.nav.signOut}
            </button>
          </div>
        ) : (
          <Link to="/login" className={`${buttonClass('primary')} hidden sm:inline-flex`}>
            {t.nav.signIn}
          </Link>
        )}
      </div>
      {menuOpen && (
        <nav
          id="mobile-nav"
          aria-label={t.nav.main}
          className={`mobile-sheet absolute inset-x-3 top-full z-50 mt-2 flex flex-col gap-1 rounded-card border border-line bg-surface/95 p-3 shadow-plate backdrop-blur-md ${sheetOnly}`}
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
              {t.nav.links[l.label]}
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
                {t.nav.signOutAs(user.name)}
              </button>
            ) : (
              <Link to="/login" className={`${buttonClass('primary')} w-full`}>
                {t.nav.signIn}
              </Link>
            )}
            <LangToggle className="mt-2 w-full sm:hidden" />
            <ThemeToggle className="mx-auto mt-2 sm:hidden" />
          </div>
        </nav>
      )}
    </header>
  );
}
