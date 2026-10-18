import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { useLang } from '../../i18n';
import { useTheme } from '../theme';
import { ScrollProgress } from './interactive';
import { NavBar } from './NavBar';
import { useSpotlight } from './pointerFx';
import { onScrollFrame } from './scrollFx';
import { Toaster } from './Toaster';

export function AppShell() {
  const { pathname } = useLocation();
  const lang = useLang();
  const theme = useTheme();
  const [scrolled, setScrolled] = useState(false);
  useSpotlight();

  // The nav turns to frosted glass once the page moves under it.
  useEffect(
    () =>
      onScrollFrame((f) => {
        const next = f.y > 8;
        setScrolled((prev) => (prev === next ? prev : next));
      }),
    [],
  );

  // A new route starts at the top, as a new page would.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <ScrollProgress />
      <div
        className={`sticky top-0 z-40 transition-colors duration-300 light:bg-surface light:shadow-sm print:hidden ${
          scrolled
            ? 'border-b border-line/70 bg-bg/75 backdrop-blur-md'
            : 'border-b border-transparent'
        }`}
      >
        <NavBar compact={scrolled} />
      </div>
      {/* Keyed by path (each page plays its entrance once), by language, so every
          label and price re-renders in the new language at once, and by theme,
          so charts and canvases re-read their colours. */}
      <div key={`${pathname}:${lang}:${theme}`} className="route-enter flex-1">
        <Outlet />
      </div>
      <Toaster />
    </div>
  );
}
