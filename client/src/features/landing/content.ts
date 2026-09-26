// Tenant landing copy for Fork & Flame, in both languages (ADR-030). The El
// Demeshki pack replaces this file's content in M17. Photos live in
// client/public/images (credits in the README).
import type { L } from '../../i18n/localized';

export const HERO = {
  headline: {
    en: 'it’s not just Food, It’s an Experience.',
    ar: 'مش مجرد أكل، دي تجربة كاملة.',
  },
  highlight: { en: 'Experience.', ar: 'تجربة كاملة.' },
  body: {
    en: 'Seasonal plates cooked over open flame. Order from your table, watch it move through the kitchen live, and pay in a tap.',
    ar: 'أطباق موسمية على نار الفحم. اطلب من طاولتك، تابع طلبك في المطبخ لحظة بلحظة، وادفع بضغطة واحدة.',
  },
  plateAlt: {
    en: 'A harvest bowl of greens, feta and pickled onion on a dark plate',
    ar: 'طبق سلطة خضراء بالجبنة الفيتا والبصل المخلل على صحن داكن',
  },
  pickLabel: { en: 'Chef’s pick', ar: 'اختيار الشيف' },
  pickName: { en: 'Harvest Bowl', ar: 'سلطة الحصاد' },
  pickOrders: { en: '320 orders', ar: '320 طلب' },
  eta: { en: '~18 min', ar: '~18 دقيقة' },
  etaLabel: { en: 'avg. to your table', ar: 'متوسط الوصول لطاولتك' },
  reviews: { en: 'from 1,200+ guest reviews', ar: 'من أكثر من 1,200 تقييم' },
} satisfies Record<string, L>;

export const GUESTS: { name: L; photo: string; quote: L }[] = [
  {
    name: { en: 'Maya R.', ar: 'مايا ر.' },
    photo: '/images/guests/1.jpg',
    quote: {
      en: 'Ordered from the table, watched the burger go from grill to plate on my phone. The wagyu is unreal.',
      ar: 'طلبت من الطاولة وتابعت البرجر من الشواية للطبق على موبايلي. الواجيو خرافي.',
    },
  },
  {
    name: { en: 'Daniel K.', ar: 'دانيال ك.' },
    photo: '/images/guests/2.jpg',
    quote: {
      en: 'We split the bill three ways in about ten seconds. The halibut with brown butter is the move.',
      ar: 'قسمنا الحساب على ثلاثة في عشر ثوانٍ. الهلبوت بالزبدة البنية اختيار موفق.',
    },
  },
  {
    name: { en: 'Sofia L.', ar: 'صوفيا ل.' },
    photo: '/images/guests/3.jpg',
    quote: {
      en: 'Best tiramisu this side of the river, and the room has the warmest light in the city.',
      ar: 'أحلى تيراميسو في المنطقة، والمكان إضاءته دافية جدًا.',
    },
  },
  {
    name: { en: 'James O.', ar: 'جيمس أ.' },
    photo: '/images/guests/4.jpg',
    quote: {
      en: 'Booked a table for eight, food arrived together and hot. Staff clearly run a tight ship.',
      ar: 'حجزنا طاولة لثمانية، والأكل وصل كله مع بعض وسخن. فريق منظم جدًا.',
    },
  },
];

export const HOURS: { days: L; time: string }[] = [
  { days: { en: 'Mon – Thu', ar: 'الإثنين – الخميس' }, time: '12:00 – 22:00' },
  { days: { en: 'Fri – Sat', ar: 'الجمعة – السبت' }, time: '12:00 – 23:00' },
  { days: { en: 'Sunday', ar: 'الأحد' }, time: '11:00 – 21:00' },
];

export const MARQUEE: L[] = [
  { en: 'Wood-fired daily', ar: 'على الحطب كل يوم' },
  { en: 'Hand-rolled pasta', ar: 'باستا بإيدينا' },
  { en: 'Local produce', ar: 'خامات محلية' },
  { en: 'Scan & order', ar: 'امسح واطلب' },
  { en: 'Live order tracking', ar: 'تتبع طلبك مباشرة' },
  { en: 'Split the bill', ar: 'قسّم الحساب' },
];

export const STORY = {
  eyebrow: { en: 'Our story', ar: 'حكايتنا' },
  title: { en: 'Fire, flour and a little patience.', ar: 'نار، ودقيق، وشوية صبر.' },
  p1: {
    en: 'Fork & Flame started as a single wood oven and a stubborn idea: cook simple things very well. Our dough rests for 48 hours, our beef is dry-aged in-house, and everything that leaves the kitchen has met the fire first.',
    ar: 'بدأنا بفرن حطب واحد وفكرة عنيدة: نطبخ الحاجات البسيطة بإتقان. العجينة بترتاح 48 ساعة، واللحمة بنعتقها عندنا، وكل طبق بيخرج من المطبخ لازم يكون شاف النار الأول.',
  },
  p2: {
    en: 'The tech is there to get out of the way. Order when you are ready, not when a server passes by, and let the kitchen do what it does best.',
    ar: 'التكنولوجيا هنا عشان تريّحك: اطلب وقت ما تكون جاهز، مش لما الجرسون يعدّي، وسيب المطبخ يعمل أحسن ما عنده.',
  },
  chefAlt: { en: 'Our head chef plating at the pass', ar: 'الشيف بيجهّز الأطباق' },
  roomAlt: { en: 'The dining room at night', ar: 'صالة المطعم بالليل' },
  years: { en: 'years over open flame', ar: 'سنة على النار' },
  stats: [
    {
      value: 48,
      decimals: 0,
      suffix: { en: 'h', ar: ' س' },
      label: { en: 'dough rest', ar: 'راحة العجينة' },
    },
    {
      value: 9,
      decimals: 0,
      suffix: { en: '', ar: '' },
      label: { en: 'signature plates', ar: 'طبق مميز' },
    },
    {
      value: 4.9,
      decimals: 1,
      suffix: { en: '★', ar: '★' },
      label: { en: 'guest rating', ar: 'تقييم الضيوف' },
    },
  ] satisfies { value: number; decimals: number; suffix: L; label: L }[],
  cta: { en: 'Explore the menu', ar: 'اكتشف المنيو' },
};

export const QUOTE = {
  text: {
    en: 'If it hasn’t met the fire, it isn’t ready for your plate.',
    ar: 'اللي ما شافش النار، مش جاهز لطبقك.',
  },
  /** The word painted in flame colour, in each language. */
  flameWord: { en: 'fire', ar: 'النار' },
  by: { en: 'Marco Bellini · Head chef', ar: 'ماركو بيليني · الشيف' },
  label: { en: 'From the kitchen', ar: 'من المطبخ' },
};

export const REVIEWS = {
  eyebrow: { en: 'Reviews', ar: 'آراء الضيوف' },
  title: { en: 'Guests keep coming back', ar: 'ضيوفنا بيرجعوا تاني' },
  rated: { en: 'Rated 5 out of 5', ar: 'التقييم 5 من 5' },
};

export const VISIT = {
  eyebrow: { en: 'Visit us', ar: 'زورونا' },
  title: { en: 'Pull up a chair', ar: 'الكرسي مستنيك' },
  photoAlt: { en: 'The bar at Fork & Flame', ar: 'البار في فورك آند فليم' },
  address: { en: '18 Ember Lane, Brooklyn, NY 11201', ar: '18 شارع إمبر، بروكلين، نيويورك' },
  phone: '+17185550142',
  phoneLabel: '(718) 555-0142',
  takeaway: { en: 'Order Takeaway', ar: 'اطلب تيك أواي' },
};

export const FOOTER = {
  tagline: { en: 'Seasonal plates, cooked over open flame.', ar: 'أطباق موسمية على نار الفحم.' },
  about: { en: 'About', ar: 'عنّا' },
  visit: { en: 'Visit', ar: 'زورونا' },
  staff: { en: 'Staff sign-in', ar: 'دخول الموظفين' },
  photos: { en: 'Photography from', ar: 'الصور من' },
};

/** The "fire to table" story: each stage drives the phone mock as you scroll. */
export const FIRE = {
  eyebrow: { en: 'How it works', ar: 'إزاي بتشتغل' },
  title: { en: 'From your table to our fire, and back', ar: 'من طاولتك لنارنا، وراجع لك' },
  keepScrolling: { en: 'Keep scrolling ↓', ar: 'كمّل نزول ↓' },
  phoneHeader: { en: 'Order A-1042 · Table 7', ar: 'طلب A-1042 · طاولة 7' },
  readyIn: { en: 'Ready in about', ar: 'جاهز خلال حوالي' },
  minutes: { en: 'min', ar: 'دقيقة' },
  balance: { en: 'Balance', ar: 'الحساب' },
  paid: { en: 'Paid', ar: 'مدفوع' },
  lines: [
    {
      name: { en: 'Wagyu Burger', ar: 'برجر واجيو' },
      note: { en: 'Large · Medium rare', ar: 'كبير · نص سوا' },
      photo: '/images/dishes/wagyu-burger.jpg',
    },
    {
      name: { en: 'Truffle Arancini', ar: 'أرانشيني بالترافل' },
      note: { en: 'With saffron', ar: 'بالزعفران' },
      photo: '/images/dishes/truffle-arancini.jpg',
    },
    {
      name: { en: 'Yuzu Lemonade', ar: 'ليمونادة يوزو' },
      note: { en: 'With mint', ar: 'بالنعناع' },
      photo: '/images/dishes/yuzu-lemonade.jpg',
    },
  ],
  stages: [
    {
      n: '01',
      title: { en: 'Scan your table', ar: 'امسح كود الطاولة' },
      body: {
        en: 'Every table has its own QR code. Scan it and the menu already knows where you sit.',
        ar: 'كل طاولة ليها كود QR خاص بيها. امسحه والمنيو هيعرف إنت قاعد فين.',
      },
      status: { en: 'Table 7 · menu open', ar: 'طاولة 7 · المنيو مفتوح' },
      progress: 0.12,
    },
    {
      n: '02',
      title: { en: 'Order your way', ar: 'اطلب على مزاجك' },
      body: {
        en: 'Large, medium-rare, no bun. Every choice is priced live and checked by the kitchen.',
        ar: 'كبير، نص سوا، من غير عيش. كل اختيار بيتحسب سعره فورًا والمطبخ بيراجعه.',
      },
      status: { en: 'Order received', ar: 'تم استلام الطلب' },
      progress: 0.38,
    },
    {
      n: '03',
      title: { en: 'It meets the fire', ar: 'على النار' },
      body: {
        en: 'Your ticket lands on the kitchen screen in under a tenth of a second, and the grill starts.',
        ar: 'طلبك بيوصل شاشة المطبخ في أقل من عُشر ثانية، والشواية تبدأ على طول.',
      },
      status: { en: 'On the grill', ar: 'على الشواية' },
      progress: 0.7,
    },
    {
      n: '04',
      title: { en: 'Straight to your table', ar: 'لحد طاولتك' },
      body: {
        en: 'Watch every step live on your phone. Add a second round or pay without waving anyone down.',
        ar: 'تابع كل خطوة على موبايلك. زوّد طلبك أو ادفع من غير ما تنادي حد.',
      },
      status: { en: 'Served · enjoy', ar: 'اتقدم · بالهنا والشفا' },
      progress: 1,
    },
  ] as const,
};
