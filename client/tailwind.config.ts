import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

// A private tenant pack (ADR-032) is scanned only when it is the one being built.
const tenant = process.env.VITE_TENANT ?? 'forkandflame';
const pack = tenant === 'forkandflame' ? [] : [`../tenants/${tenant}/client/**/*.{ts,tsx}`];

// Design direction 31 "Fork & Flame" (ADR-019). Components use these tokens
// only — never a raw hex value (CODING-STANDARDS §15, fork-flame-ui skill §2).
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}', ...pack],
  theme: {
    extend: {
      // Every colour reads a CSS variable from styles/themes.css, so a theme
      // (dark, or the cream light) swaps them all at once (ADR-033).
      colors: {
        bg: {
          DEFAULT: 'rgb(var(--c-bg) / <alpha-value>)',
          deep: 'rgb(var(--c-bg-deep) / <alpha-value>)',
        },
        surface: {
          DEFAULT: 'rgb(var(--c-surface) / <alpha-value>)',
          raised: 'rgb(var(--c-surface-raised) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'rgb(var(--c-card) / <alpha-value>)',
          top: 'rgb(var(--c-card-top) / <alpha-value>)',
          bottom: 'rgb(var(--c-card-bottom) / <alpha-value>)',
        },
        line: {
          DEFAULT: 'rgb(var(--c-line) / <alpha-value>)',
          strong: 'rgb(var(--c-line-strong) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--c-ink) / <alpha-value>)',
          muted: 'rgb(var(--c-ink-muted) / <alpha-value>)',
          inverse: 'rgb(var(--c-ink-inverse) / <alpha-value>)',
        },
        // `flame` is the accent, for fills and large text only; small accent
        // text uses `flame-text`, which keeps AA contrast on bg (NFR-U3).
        flame: {
          DEFAULT: 'rgb(var(--c-flame) / <alpha-value>)',
          light: 'rgb(var(--c-flame-light) / <alpha-value>)',
          dark: 'rgb(var(--c-flame-dark) / <alpha-value>)',
          text: 'rgb(var(--c-flame-text) / <alpha-value>)',
        },
        star: 'rgb(var(--c-star) / <alpha-value>)',
        ok: 'rgb(var(--c-ok) / <alpha-value>)',
        warn: 'rgb(var(--c-warn) / <alpha-value>)',
        // Receipts and tickets look like paper in every theme.
        paper: { DEFAULT: '#ffffff', ink: '#141414' },
        // Poster blocks for a tenant's own identity (ADR-034): the same in every theme.
        brand: {
          ink: '#1f1d1d',
          cream: '#f6f1e7',
          sand: '#ebe3d3',
          saffron: '#eaa01a',
          amber: '#7d5100',
        },
      },
      // Headline-size accent text has its own value: in the light theme the
      // accent fill is charcoal, which would not stand out from body text.
      textColor: { flame: { DEFAULT: 'rgb(var(--c-flame-large) / <alpha-value>)' } },
      fontFamily: {
        // Latin faces first; Arabic glyphs fall through to El Messiri / Cairo
        // (M14-S6). The stacks are set in styles/themes.css; a tenant's stylesheet may override them.
        display: ['var(--font-display)'],
        sans: ['var(--font-sans)'],
        hand: ['var(--font-hand)'],
      },
      fontSize: {
        hero: ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.01em' }],
        'hero-sm': ['2.5rem', { lineHeight: '1.1' }],
        plate: ['9rem', { lineHeight: '1' }],
      },
      borderRadius: {
        card: '20px',
        frame: '26px',
        btn: '9999px',
        icon: '12px',
      },
      boxShadow: {
        plate: 'var(--shadow-plate)',
        dish: 'var(--shadow-dish)',
        glow: 'var(--shadow-glow)',
      },
      backgroundImage: {
        page: 'var(--bg-page)',
        flame: 'linear-gradient(180deg, rgb(var(--c-flame-light)), rgb(var(--c-flame-dark)))',
        card: 'linear-gradient(180deg, rgb(var(--c-card-top)), rgb(var(--c-card-bottom)))',
        slate: 'var(--bg-slate)',
      },
      maxWidth: { content: '1100px' },
      keyframes: {
        bob: {
          '0%, 100%': { transform: 'translateY(0) rotate(-6deg)' },
          '50%': { transform: 'translateY(-14px) rotate(6deg)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        rise: {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        // Cart badge pop when the count changes (keyed remount in NavBar).
        pop: {
          '0%': { transform: 'scale(.4)' },
          '55%': { transform: 'scale(1.25)' },
          '100%': { transform: 'scale(1)' },
        },
        // New kitchen tickets slide in once, on mount only (KDS).
        'drop-in': {
          from: { opacity: '0', transform: 'translateY(-12px) scale(.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        bob: 'bob 3.4s ease-in-out infinite',
        float: 'float 4.5s ease-in-out infinite',
        'spin-slow': 'spin 80s linear infinite',
        marquee: 'marquee 36s linear infinite',
        rise: 'rise .8s cubic-bezier(.2,.7,.2,1) both',
        pop: 'pop .45s cubic-bezier(.2,.7,.2,1) both',
        'drop-in': 'drop-in .45s cubic-bezier(.2,.7,.2,1) both',
      },
    },
  },
  plugins: [
    // `light:` styles apply only in the light theme; unprefixed styles are the dark design.
    plugin((api) => api.addVariant('light', 'html[data-theme="light"] &')),
  ],
} satisfies Config;
