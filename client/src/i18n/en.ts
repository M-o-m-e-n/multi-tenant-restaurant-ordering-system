/**
 * English UI strings. This dictionary defines the key set: every other
 * language must provide the same keys (see `Widen` in ./types).
 * Menu content (dish names, descriptions) is data, not UI, and is not here.
 */
import { plural } from './plural';

export const en = {
  lang: {
    switchTo: 'العربية',
    switchLabel: 'Switch to Arabic',
  },
  nav: {
    links: {
      home: 'Home',
      menu: 'Menu',
      book: 'Book',
      myOrders: 'My orders',
      kitchen: 'Kitchen',
      pos: 'POS',
      tables: 'Tables',
      bookings: 'Bookings',
      admin: 'Admin',
    },
    main: 'Main',
    signIn: 'Sign In',
    signOut: 'Sign out',
    signOutAs: (name: string) => `Sign out · ${name}`,
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    homeLabel: 'Home',
    cart: (n: number) => `Cart, ${plural('en', n, { one: '1 item', other: '{n} items' })}`,
  },
} as const;
