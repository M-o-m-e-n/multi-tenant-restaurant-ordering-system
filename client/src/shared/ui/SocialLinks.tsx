import { brand } from '../../brand';
import { useT } from '../../i18n';

function SocialIcon({ kind }: { kind: 'facebook' | 'instagram' }) {
  return kind === 'facebook' ? (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
      <path d="M14 8h3V4h-3c-2.8 0-4 1.7-4 4.3V10H7v4h3v8h4v-8h3l1-4h-4V8.6c0-.4.3-.6.6-.6Z" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
    </svg>
  );
}

/** Social links for the tenant, as round icon buttons with spoken names. */
export function SocialLinks() {
  const t = useT();
  const links = (['facebook', 'instagram'] as const).filter((k) => brand.social[k]);
  return (
    <ul className="flex gap-2" aria-label={t.contact.follow}>
      {links.map((k) => (
        <li key={k}>
          <a
            href={brand.social[k]}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={k === 'facebook' ? 'Facebook' : 'Instagram'}
            className="grid size-11 place-items-center rounded-full border border-line-strong text-ink transition hover:border-flame hover:bg-flame hover:text-white"
          >
            <SocialIcon kind={k} />
          </a>
        </li>
      ))}
    </ul>
  );
}
