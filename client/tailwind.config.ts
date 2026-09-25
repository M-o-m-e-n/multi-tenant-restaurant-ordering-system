import type { Config } from 'tailwindcss';

// Design direction 31 "Fork & Flame" (ADR-019). Components use these tokens
// only — never a raw hex value (CODING-STANDARDS §15, fork-flame-ui skill §2).
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: '#141414', deep: '#0b0b0b' },
        surface: { DEFAULT: '#1e1e1e', raised: '#2b2b2b' },
        card: { DEFAULT: '#242424', top: '#2a2a2a', bottom: '#1a1a1a' },
        line: { DEFAULT: '#333333', strong: '#3d3d3d' },
        ink: { DEFAULT: '#f5f2ec', muted: '#a9a49a', inverse: '#141414' },
        // `flame` is for fills and large text only; small red text uses
        // `flame-text`, which keeps 6:1 contrast on bg (NFR-U3).
        flame: { DEFAULT: '#e5322d', light: '#f0443e', dark: '#b91414', text: '#ff5a52' },
        star: '#f5a623',
        ok: '#3ecf8e',
        warn: '#f5a623',
      },
      fontFamily: {
        display: ['Philosopher', '"Playfair Display"', 'serif'],
        sans: ['Poppins', 'Inter', 'system-ui', 'sans-serif'],
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
        plate: '0 30px 70px rgba(0,0,0,.6), inset 0 4px 14px rgba(255,255,255,.08)',
        dish: '0 14px 26px rgba(0,0,0,.5)',
        glow: '0 6px 18px rgba(229,50,45,.40)',
      },
      backgroundImage: {
        page: 'radial-gradient(ellipse at 70% 20%, #232323 0%, #141414 45%, #0b0b0b 100%)',
        flame: 'linear-gradient(180deg, #f0443e, #b91414)',
        card: 'linear-gradient(180deg, #2a2a2a, #1a1a1a)',
        slate: 'radial-gradient(circle at 50% 42%, #3a3a3a 0 58%, #2b2b2b 59% 68%, #171717 69%)',
      },
      maxWidth: { content: '1100px' },
      keyframes: {
        bob: {
          '0%, 100%': { transform: 'translateY(0) rotate(-6deg)' },
          '50%': { transform: 'translateY(-14px) rotate(6deg)' },
        },
      },
      animation: { bob: 'bob 3.4s ease-in-out infinite' },
    },
  },
  plugins: [],
} satisfies Config;
