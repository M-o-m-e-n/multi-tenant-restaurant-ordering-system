import type { BranchDto } from '@ros/shared';
import { useState } from 'react';

import { useT } from '../../i18n';
import { buttonClass } from '../../shared/ui/buttonClass';
import { nearest } from './maps';

export type NearestResult = { slug: string; km: number } | null;

type State = 'idle' | 'locating' | 'denied' | 'unsupported';

/**
 * "Find the branch nearest me": the browser's own Geolocation API (free),
 * asked only after a tap. The position never leaves the phone; the distance
 * is worked out here.
 */
export function NearestBranchButton({
  branches,
  onFound,
}: {
  branches: readonly BranchDto[];
  onFound: (result: NearestResult) => void;
}) {
  const t = useT();
  const [state, setState] = useState<State>('idle');

  const locate = () => {
    if (!('geolocation' in navigator)) {
      setState('unsupported');
      return;
    }
    setState('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const near = nearest({ lat: pos.coords.latitude, lng: pos.coords.longitude }, branches);
        setState('idle');
        onFound(near ? { slug: near.place.slug, km: near.km } : null);
      },
      () => setState('denied'),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  };

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <button
        type="button"
        onClick={locate}
        disabled={state === 'locating'}
        className={`${buttonClass('secondary')} group`}
      >
        <svg
          viewBox="0 0 24 24"
          className={`size-4 ${state === 'locating' ? 'motion-safe:animate-spin' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
        {state === 'locating' ? t.branches.locating : t.branches.findNearest}
      </button>
      <p className="max-w-sm text-xs text-ink-muted" role="status">
        {state === 'denied'
          ? t.branches.denied
          : state === 'unsupported'
            ? t.branches.unsupported
            : t.branches.privacy}
      </p>
    </div>
  );
}
