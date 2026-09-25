import type { en } from './en';
import { plural } from './plural';
import type { Widen } from './types';

/** Arabic UI strings (the default language for Arabic tenants, ADR-030). */
export const ar: Widen<typeof en> = {
  lang: {
    switchTo: 'English',
    switchLabel: 'التبديل إلى الإنجليزية',
  },
  nav: {
    links: {
      home: 'الرئيسية',
      menu: 'المنيو',
      book: 'احجز',
      myOrders: 'طلباتي',
      kitchen: 'المطبخ',
      pos: 'الكاشير',
      tables: 'الطاولات',
      bookings: 'الحجوزات',
      admin: 'الإدارة',
    },
    main: 'القائمة الرئيسية',
    signIn: 'تسجيل الدخول',
    signOut: 'تسجيل الخروج',
    signOutAs: (name) => `تسجيل الخروج · ${name}`,
    openMenu: 'فتح القائمة',
    closeMenu: 'إغلاق القائمة',
    homeLabel: 'الصفحة الرئيسية',
    cart: (n) =>
      `السلة، ${plural('ar', n, { zero: 'فارغة', one: 'صنف واحد', two: 'صنفان', few: '{n} أصناف', many: '{n} صنفًا', other: '{n} صنف' })}`,
  },
};
