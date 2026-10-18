import type { WeekHours } from '@ros/shared';
import { useEffect, useState } from 'react';

import { useLang, useT } from '../../i18n';
import { useSettings } from '../cart/cartApi';
import { hourLabel, OPENING, openStatus } from '../landing/openHours';

/** Re-render every minute so an open chip turns to closed without a reload. */
function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** The live "open now" line for a week of hours, on the restaurant's clock. */
export function useOpenLabel(week: WeekHours = OPENING): { open: boolean; label: string } {
  const { data: settings } = useSettings();
  const tz = settings?.timezone ?? 'America/New_York';
  const now = useMinuteClock();
  const status = openStatus(now, tz, week);
  const t = useT();
  const lang = useLang();
  if (status.open) {
    const fn = status.closingSoon ? t.landing.closingSoon : t.landing.openNow;
    return { open: true, label: fn(hourLabel(status.closesAt, lang)) };
  }
  if (status.opens === null) return { open: false, label: t.landing.closedNow };
  const fn = status.opens === 'today' ? t.landing.opensToday : t.landing.opensTomorrow;
  return { open: false, label: fn(hourLabel(status.opensAt, lang)) };
}
