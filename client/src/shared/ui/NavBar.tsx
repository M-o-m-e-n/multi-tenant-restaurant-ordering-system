import { Link, NavLink, useNavigate } from 'react-router-dom';

import { useAuth } from '../../features/auth/authStore';
import { cartCount, useCart } from '../../features/cart/cartStore';
import { CartIcon } from '../../features/menu/DishCard';
import { buttonClass } from './buttonClass';
import { Logo } from './Logo';

const links = [
  { to: '/', label: 'Home', end: true, roles: null },
  { to: '/menu', label: 'Menu', end: false, roles: null },
  { to: '/kitchen', label: 'Kitchen', end: false, roles: ['STAFF', 'ADMIN'] },
  { to: '/pos/tables', label: 'Tables', end: false, roles: ['STAFF', 'ADMIN'] },
  { to: '/admin/menu', label: 'Admin', end: false, roles: ['ADMIN'] },
] as const;

export function NavBar() {
  const { status, user, logout } = useAuth();
  const navigate = useNavigate();
  const count = useCart((s) => cartCount(s.lines));
  const visible = links.filter(
    (l) => l.roles === null || (user && (l.roles as readonly string[]).includes(user.role)),
  );

  return (
    <header className="mx-auto flex w-full max-w-content items-center justify-between gap-4 px-5 py-5 md:px-8">
      <Link to="/" aria-label="Fork and Flame home">
        <Logo />
      </Link>
      <nav aria-label="Main" className="hidden gap-7 md:flex">
        {visible.map((l) => (
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
        <Link
          to="/cart"
          aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`}
          className="relative grid size-11 place-items-center rounded-full text-ink hover:bg-surface-raised"
        >
          <CartIcon className="size-6" />
          {count > 0 && (
            <span className="absolute right-0.5 top-0.5 grid min-w-5 place-items-center rounded-full bg-flame px-1 text-[0.65rem] font-bold text-white">
              {count}
            </span>
          )}
        </Link>
        {status === 'authenticated' && user ? (
          <>
            <span className="hidden text-sm text-ink-muted sm:inline">{user.name}</span>
            <button
              type="button"
              className={buttonClass('ghost', 'sm')}
              onClick={() => {
                void logout().then(() => navigate('/'));
              }}
            >
              Sign out
            </button>
          </>
        ) : (
          <Link to="/login" className={buttonClass('primary')}>
            Sign In
          </Link>
        )}
      </div>
    </header>
  );
}
