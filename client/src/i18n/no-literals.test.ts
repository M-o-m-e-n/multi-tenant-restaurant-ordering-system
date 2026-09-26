import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * M14-S2/S3 "done when": no English is hard-coded in screens a guest or staff
 * member reads. UI text comes from the dictionaries (useT) and tenant copy
 * (useL). This scans JSX text and user-facing string attributes; it is a
 * guard, not a parser, so the few legitimate literals are listed below.
 */
const SRC = join(__dirname, '..');

const SCANNED = [
  'pages/customer',
  'pages/auth',
  'pages/NotFoundPage.tsx',
  'features/landing',
  'features/cart',
  'features/menu',
  'features/orders',
  'features/delivery',
  'features/table',
  'features/auth',
  'shared/ui',
  'pages/kitchen',
  'pages/pos',
  'pages/admin',
  'features/kds',
  'features/pos',
  'features/admin',
  'features/reservations',
];

/** Literals that are not language: brand art, symbols, codes, test cards. */
const ALLOWED = [
  /^Fork$/, // the Fork & Flame wordmark (Logo.tsx) is brand art in both languages
  /^Flame$/,
  /^SAVE10$/, // an example promo code
  /^Unsplash$/, // the photo source, a proper name
];

function files(path: string): string[] {
  const full = join(SRC, path);
  if (statSync(full).isFile()) return [full];
  return readdirSync(full).flatMap((name) => files(join(path, name)));
}

const JSX_TEXT = />\s*([^<>{}]*[A-Za-z]{2,}[^<>{}]*?)\s*</g;
const ATTR = /\b(?:aria-label|placeholder|label|alt|title)="([^"]*[A-Za-z]{2,}[^"]*)"/g;

describe('no hard-coded English in UI', () => {
  const offenders: string[] = [];
  for (const file of SCANNED.flatMap(files)) {
    if (!file.endsWith('.tsx') || file.endsWith('.test.tsx')) continue;
    const text = readFileSync(file, 'utf8')
      // Comments and type-only lines are not UI.
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
    for (const re of [JSX_TEXT, ATTR]) {
      for (const m of text.matchAll(re)) {
        const literal = (m[1] ?? '').trim();
        if (!literal || ALLOWED.some((a) => a.test(literal))) continue;
        // Generic type arguments and arrow bodies are not text nodes.
        // Expressions caught between angle brackets (`> 0 && (`, `api<Dto>(`) are
        // code, not text: operators, calls, lone identifiers.
        if (/=>|\bconst\b|[;=]|\w+\(|&&|\|\||\?|^\)|^[a-z]\w*$|^Promise$/.test(literal)) continue;
        offenders.push(`${relative(SRC, file)}: "${literal}"`);
      }
    }
  }

  it('finds every visible string in a dictionary or tenant copy', () => {
    expect(offenders).toEqual([]);
  });
});
