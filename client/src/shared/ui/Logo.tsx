import { brand } from '../../brand';
import { useLang } from '../../i18n';

/**
 * The tenant's mark. Fork & Flame is set in type; a tenant with an image logo
 * shows it beside its name. Dark-on-light logos are inverted and screened so
 * they sit on the dark theme without a white box, and shown as drawn on the
 * light one.
 */
export function Logo() {
  const lang = useLang();
  if (brand.logo) {
    return (
      <span className="flex items-center gap-2 whitespace-nowrap">
        <img
          src={brand.logo}
          alt=""
          width={80}
          height={46}
          className="h-10 w-auto mix-blend-screen invert light:mix-blend-multiply light:invert-0 sm:h-12"
        />
        <span className="font-display text-lg font-bold text-ink sm:text-xl">
          {brand.name[lang]}
        </span>
      </span>
    );
  }
  return (
    <span className="whitespace-nowrap font-display text-xl font-bold text-ink sm:text-2xl">
      Fork <span className="text-flame">&amp;</span> Flame
    </span>
  );
}
