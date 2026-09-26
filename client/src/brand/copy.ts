import type { L } from '../i18n/localized';

/**
 * Tenant copy used outside the landing page (ADR-029/030). The landing's own
 * copy lives in features/landing/content.ts; both are swapped per tenant.
 */
export const MENU_BANNER = {
  eyebrow: { en: 'Tonight’s menu', ar: 'منيو الليلة' },
  title: { en: 'Cooked over open flame.', ar: 'مطبوخ على النار.' },
  body: {
    en: 'Pick a plate, tweak it your way, and we’ll fire it the moment you order.',
    ar: 'اختار طبقك، ظبّطه على مزاجك، وإحنا نبدأ نطبخه أول ما تطلب.',
  },
} satisfies Record<string, L>;

export const RESERVE_PANEL = {
  title: { en: 'Your table, by the fire.', ar: 'طاولتك جنب النار.' },
  body: {
    en: 'We hold every booking for 15 minutes. Running late? Give us a call.',
    ar: 'بنحجز الطاولة 15 دقيقة. هتتأخر؟ كلّمنا.',
  },
} satisfies Record<string, L>;
