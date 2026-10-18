import type { Tenant } from '../../brand/types';

/** The portfolio demo (design 31), and the default build. */
export const tenant: Tenant = {
  brand: {
    id: 'forkandflame',
    name: { en: 'Fork & Flame', ar: 'فورك آند فليم' },
    defaultLang: 'en',
    currency: 'usd',
    logo: null,
    social: {},
    pages: { branches: false, about: false, contact: false },
    themes: ['dark'],
    menu: 'list',
    mapCentre: { lat: 30.0444, lng: 31.2357 },
  },
  copy: {
    menuPhoto: '/images/spread.jpg',
    menuBanner: {
      eyebrow: { en: 'Tonight’s menu', ar: 'منيو الليلة' },
      title: { en: 'Cooked over open flame.', ar: 'مطبوخ على النار.' },
      body: {
        en: 'Pick a plate, tweak it your way, and we’ll fire it the moment you order.',
        ar: 'اختار طبقك، ظبّطه على مزاجك، وإحنا نبدأ نطبخه أول ما تطلب.',
      },
    },
    reservePanel: {
      title: { en: 'Your table, by the fire.', ar: 'طاولتك جنب النار.' },
      body: {
        en: 'We hold every booking for 15 minutes. Running late? Give us a call.',
        ar: 'بنحجز الطاولة 15 دقيقة. هتتأخر؟ كلّمنا.',
      },
    },
  },
};
