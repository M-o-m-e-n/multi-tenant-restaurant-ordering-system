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

export const STEPS = [
  {
    n: '01',
    title: 'Scan your table',
    body: 'Every table has its own QR code. Scan it and the menu already knows where you are sitting.',
    photo: '/images/interior.jpg',
  },
  {
    n: '02',
    title: 'Order your way',
    body: 'Pick sizes, doneness and extras. Pay by card, or settle up with your server at the end.',
    photo: '/images/spread.jpg',
  },
  {
    n: '03',
    title: 'Track it live',
    body: 'Watch your order move from the pass to the grill to your table, in real time.',
    photo: '/images/dining.jpg',
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
