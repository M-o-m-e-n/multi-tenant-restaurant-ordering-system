---
name: fork-flame-ui
description: The ROS frontend design system ("Fork & Flame", design direction 31). Load before writing or changing any client UI — pages, components, Tailwind config, colours, typography, icons, charts, or the KDS/POS/admin screens — so everything matches the chosen dark, red-accent, plated-food look.
---

# Fork & Flame — ROS UI design system

The chosen frontend direction is **design 31** (ADR-019). Two sources define it:

| Source | Path | Use it for |
|---|---|---|
| Reference screenshot | `designs/reference/31-reference-landing.png` | **The visual target.** Look at it before building any customer-facing screen. |
| Working prototype | `designs/31-fork-flame-landing.html` | Layout, spacing and interactions (carousel, chips, cart bar, booking modal) |

If they disagree, **the screenshot wins on look** (type, colour, depth, imagery) and **this skill wins on
accessibility** (contrast, focus, target size). Don't copy the screenshot's brand name ("Huff & Puff").
The product is **Fork & Flame**.

## 1. Mood

Dark and warm, like a restaurant at night. The food is lit like a studio shot against charcoal. There is
one accent colour, red, and it is used on actions only. Things feel physical: plates cast shadows,
cards rise up behind the plates, buttons glow slightly. There is lots of empty space and only a few
elements per screen.

## 2. Tokens

Put these in `client/tailwind.config.ts` under `theme.extend` (M0-S10). **Never write a hex value in a
component.** Use a token every time.

```ts
colors: {
  bg:        { DEFAULT: '#141414', deep: '#0b0b0b' },   // page; outer vignette
  surface:   '#1e1e1e',                                  // panels, modals
  card:      { DEFAULT: '#242424', top: '#2a2a2a', bottom: '#1a1a1a' }, // dish-card gradient
  line:      '#333333',                                  // 1px borders, dividers
  ink:       { DEFAULT: '#f5f2ec', muted: '#a9a49a' },   // text
  flame:     { DEFAULT: '#e5322d', light: '#f0443e', dark: '#b91414', text: '#ff5a52' },
  star:      '#f5a623',
  ok:        '#3ecf8e', warn: '#f5a623',                 // KDS/POS status only, always with a label
},
fontFamily: {
  display: ['Philosopher', 'Playfair Display', 'serif'], // headlines, logo, section titles
  sans:    ['Poppins', 'Inter', 'system-ui', 'sans-serif'], // everything else
},
borderRadius: { card: '20px', frame: '26px', btn: '9999px', icon: '12px' },
boxShadow: {
  plate: '0 30px 70px rgba(0,0,0,.6), inset 0 4px 14px rgba(255,255,255,.08)',
  dish:  '0 14px 26px rgba(0,0,0,.5)',
  glow:  '0 6px 18px rgba(229,50,45,.40)',
},
backgroundImage: {
  page:  'radial-gradient(ellipse at 70% 20%, #232323 0%, #141414 45%, #0b0b0b 100%)',
  flame: 'linear-gradient(180deg, #f0443e, #b91414)',
  card:  'linear-gradient(180deg, #2a2a2a, #1a1a1a)',
},
```

Fonts come from Google Fonts: `Philosopher:wght@400;700` and `Poppins:wght@400;500;600;700`.
Philosopher is the closest free match for the screenshot's headline serif. If it doesn't render well
at a given size, fall back to Playfair Display, which the prototype uses.

### Contrast rules (NFR-U2, WCAG AA)
- `flame` (#e5322d) on `bg` is only **3.5 : 1**. It's fine for **fills** (buttons, badges, icon
  tiles) and for large headline text. **Never use it for small text.**
- Red *text* (prices, links, inline errors) uses **`flame-text` (#ff5a52)**, which is 6.0 : 1 on `bg`.
- White on a `flame` fill is 5.3 : 1. That's fine for button labels.
- `ink-muted` on `bg` is 7.4 : 1. Use it for descriptions, captions and labels.

## 3. Type scale

| Role | Font | Size (desktop / mobile) | Weight | Notes |
|---|---|---|---|---|
| Hero headline | display | 56 / 40 px, line-height 1.1 | 700 | Sentence case, casual: "it's not just Food, It's an Experience." |
| Section title | display | 22–28 px | 700 | "Chef's signatures", "The full menu" |
| Logo | display | 24 px | 700 | `Fork <span class="text-flame">&</span> Flame` |
| Nav link | sans | 14 px | 500 | Active item in white at weight 600, others at 90% opacity |
| Card title | sans | 16 px | 500 | "Pappardelle" |
| Card subtitle | sans | 12 px | 400 | `ink-muted`, "With Vegetable" |
| Price | sans | 15 px | 600 | `flame-text`, formatted from cents with `Intl.NumberFormat` |
| Button | sans | 14 px | 600 | |
| Caption / label | sans | 12 px | 500 | `ink-muted` |

## 4. Components (as they appear in the screenshot)

- **Page frame.** Full-bleed `bg-page` radial vignette. Content max width is about 1100 px. The browser
  dots and outer frame in the prototype are presentation only. **Don't build them into the app.**
- **Top nav.** Logo on the left. Links in the centre (Home · Menu · About Us · Contact). On the right,
  a cart bag icon with a small red dot when the cart has items (a count badge on mobile), then a
  **Sign Up** flame pill. Links collapse into a menu button under 700 px.
- **Primary button.** A pill filled with `bg-flame` and a `shadow-glow`. Label in white.
  Example: "View Menu".
- **Secondary button.** A white pill with a dark label. Example: "Book A Table".
- **Hero.** Two columns. On the left, the headline, both CTAs, and a *Reviews* block (overlapping 34 px
  avatars plus a "45+" chip, then 5 gold stars). On the right, one large dish photo on a dark
  textured slate disc (`shadow-plate`). Scattered around it are 2–4 floating garnish cut-outs (basil
  leaves, a tomato) with a slow 3–4 s bob. The garnish is decorative: give it `aria-hidden`, and
  disable the bob under `prefers-reduced-motion`.
- **Dish card (carousel).** A `bg-card` gradient card with a `rounded-card` corner and a soft shadow.
  A **circular plate photo (≈150 px) overlaps the card's top edge** by about a third. Below it, the
  title, a muted subtitle, and a bottom row with the price on the left and a **red rounded-square cart
  button** (`rounded-icon`, 38–44 px) on the right. Cards are about 200 px wide with an 18 px gap.
- **Carousel arrows.** Circles about 42 px across, vertically centred on the cards. The *previous*
  arrow is grey (`#3d3d3d`) and the *next* arrow is `flame` with a glow. Hide the arrows on touch
  widths; the carousel scrolls natively.
- **Category chips.** Pills with a `surface` fill and a `line` border. The active chip is filled with
  `flame`.
- **Menu list row.** Round thumbnail, then the name and muted description, then the price, then a
  small red `+` tile. Rows are separated by 1 px `line` dividers.
- **Cart bar.** A sticky bar at the bottom in `bg-flame`, `rounded-2xl`, with a glow. It shows the
  total and item count on the left and a white "Checkout →" button on the right.
- **Modal.** A `surface` box, `rounded-card`, with a 1 px `line` border. Labels are small uppercase
  `ink-muted`. Inputs are filled with `bg` and have `line` borders.
- **Sold-out (86'd) item.** Keep the card visible. Desaturate the photo (`grayscale opacity-60`),
  replace the cart button with a **"Sold out" text badge**, and disable the action. Never rely on
  colour alone (NFR-U3).

## 5. Imagery

- Dishes are **top-down photos, cut out onto round plates**, on transparent or dark backgrounds, lit
  from above. Use one consistent style for the whole menu.
- The prototype uses emoji as placeholders. Real screens use `MenuItem.imageUrl` in a
  `rounded-full object-cover` frame, and show a neutral plate placeholder when there's no image.
- Every image gets an `alt` equal to the dish name. Decorative garnish gets `alt=""` or `aria-hidden`.

## 6. Applying it beyond the landing page

The screenshot covers only the customer landing and menu. Other screens borrow its vocabulary:

| Screen | How the system applies |
|---|---|
| Customer menu, cart, checkout, tracker (M4, M6, M7) | Direct use of the components above. The tracker timeline uses `line` connectors, `flame` for the current step, and a text label on every step. |
| KDS (M8) | Same tokens but **denser, with no hero or imagery**. Ticket cards on `surface`, `display` font for order numbers. Ageing bands use `ok` / `warn` / `flame` **plus a text label** ("4 min", "LATE"). Touch targets are ≥ 44 px. |
| POS / table map (M5, M9) | Tables are `card` tiles. Status is shown by an icon, a text label and a colour together. |
| Admin & reports (M11) | Simple `surface` panels, `display` for headings. Recharts series start with `flame`, then use neutrals. Take axis and label colours from `ink-muted` through the tokens and never hard-code them. |
| Receipts (M10) | The print stylesheet switches to **black on white**. Dark theme is screen only. |

## 7. Checklist before finishing a UI change

- [ ] No raw hex, px font size or font family in components. Tokens only.
- [ ] Red text uses `flame-text`. `flame` is used only for fills or large text.
- [ ] Interactive elements have a visible focus ring (`ring-2 ring-flame-light ring-offset-2 ring-offset-bg`)
      and are ≥ 44 × 44 px on touch screens.
- [ ] State is never shown by colour alone.
- [ ] Animation respects `prefers-reduced-motion`.
- [ ] Layout works at 360 px wide with no horizontal page scroll.
- [ ] Money is displayed from integer cents. No pricing arithmetic in components (use `shared` `computeTotals`).
- [ ] Compared side by side with `designs/reference/31-reference-landing.png` for customer screens.
