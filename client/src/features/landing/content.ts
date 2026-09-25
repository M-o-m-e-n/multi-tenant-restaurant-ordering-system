// Static landing-page copy. Photos live in client/public/images (credits in the README).

export const GUESTS = [
  {
    name: 'Maya R.',
    photo: '/images/guests/1.jpg',
    quote:
      'Ordered from the table, watched the burger go from grill to plate on my phone. The wagyu is unreal.',
  },
  {
    name: 'Daniel K.',
    photo: '/images/guests/2.jpg',
    quote:
      'We split the bill three ways in about ten seconds. The halibut with brown butter is the move.',
  },
  {
    name: 'Sofia L.',
    photo: '/images/guests/3.jpg',
    quote: 'Best tiramisu this side of the river, and the room has the warmest light in the city.',
  },
  {
    name: 'James O.',
    photo: '/images/guests/4.jpg',
    quote:
      'Booked a table for eight, food arrived together and hot. Staff clearly run a tight ship.',
  },
] as const;

export const HOURS = [
  { days: 'Mon – Thu', time: '12:00 – 22:00' },
  { days: 'Fri – Sat', time: '12:00 – 23:00' },
  { days: 'Sunday', time: '11:00 – 21:00' },
] as const;

export const MARQUEE = [
  'Wood-fired daily',
  'Hand-rolled pasta',
  'Local produce',
  'Scan & order',
  'Live order tracking',
  'Split the bill',
] as const;

/** The "fire to table" story: each stage drives the phone mock as you scroll. */
export const FIRE_STAGES = [
  {
    n: '01',
    title: 'Scan your table',
    body: 'Every table has its own QR code. Scan it and the menu already knows where you sit.',
    status: 'Table 7 · menu open',
    progress: 0.12,
  },
  {
    n: '02',
    title: 'Order your way',
    body: 'Large, medium-rare, no bun. Every choice is priced live and checked by the kitchen.',
    status: 'Order received',
    progress: 0.38,
  },
  {
    n: '03',
    title: 'It meets the fire',
    body: 'Your ticket lands on the kitchen screen in under a tenth of a second, and the grill starts.',
    status: 'On the grill',
    progress: 0.7,
  },
  {
    n: '04',
    title: 'Straight to your table',
    body: 'Watch every step live on your phone. Add a second round or pay without waving anyone down.',
    status: 'Served · enjoy',
    progress: 1,
  },
] as const;
