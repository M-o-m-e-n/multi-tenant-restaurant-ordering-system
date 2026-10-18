import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

import { type Role, signIn } from './helpers';

/** M13-S5: axe (WCAG 2.1 A/AA) finds no violations on any screen, per role. */
const PAGES: { role: Role | null; paths: string[] }[] = [
  { role: null, paths: ['/', '/menu', '/cart', '/login', '/register'] },
  { role: 'guest', paths: ['/reserve', '/orders'] },
  { role: 'staff', paths: ['/kitchen', '/pos', '/pos/tables', '/pos/reservations'] },
  { role: 'admin', paths: ['/admin', '/admin/reports', '/admin/menu'] },
];

async function audit(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  // Entrance animations fade content in; measuring contrast mid-fade reads grey on grey.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const summary = result.violations.map(
    (v) =>
      `${v.id} (${v.impact ?? 'n/a'}): ${v.nodes
        .map((n) => n.target.join(' '))
        .slice(0, 3)
        .join(' | ')}`,
  );
  expect(summary, `axe on ${path}`).toEqual([]);
}

/** Switch the persisted language (as the nav toggle does); the next load uses it. */
async function useLanguage(page: Page, lang: 'en' | 'ar') {
  await page.evaluate((l) => {
    localStorage.setItem('ros-lang', JSON.stringify({ state: { lang: l }, version: 1 }));
  }, lang);
}

// Every screen, in English and in Arabic RTL (M14-S10).
for (const lang of ['en', 'ar'] as const) {
  for (const { role, paths } of PAGES) {
    test(`axe (${lang}): ${role ?? 'anonymous'} screens`, async ({ page }) => {
      // Sign in through the English form, then switch: the audit is of the screens.
      await page.goto('/');
      if (role) await signIn(page, role);
      await useLanguage(page, lang);
      for (const path of paths) await audit(page, path);
      if (lang === 'ar') {
        expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl');
      }
    });
  }
}

test('keyboard: the landing CTA and menu are reachable and operable without a mouse', async ({
  page,
}) => {
  await page.goto('/');
  // Tab until the first primary CTA has focus, then activate it with Enter.
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    const text = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? '');
    if (text.startsWith('View Menu')) break;
  }
  // The arrow after the label is aria-hidden, so the accessible name stays "View Menu".
  await expect(page.locator(':focus')).toHaveAccessibleName('View Menu');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/menu$/);
});

test('touch targets: KDS bump buttons are at least 44 px high', async ({ page }) => {
  await signIn(page, 'staff', '/kitchen');
  const buttons = page.getByRole('button', { name: /→$/ });
  const count = await buttons.count();
  for (let i = 0; i < Math.min(count, 5); i++) {
    const box = await buttons.nth(i).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
});

test('menu text follows the language: Arabic dish, group and option names (ADR-037)', async ({
  page,
}) => {
  await page.goto('/');
  await useLanguage(page, 'ar');
  await page.goto('/menu');
  await expect(page.getByText('بيتزا مارجريتا').first()).toBeVisible();
  await expect(page.getByText('Margherita D.O.C.')).toHaveCount(0);
  await page
    .getByRole('button', { name: /بيتزا مارجريتا/ })
    .first()
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('الحجم')).toBeVisible();
  await expect(dialog.getByText('كبير')).toBeVisible();

  // Back to English: the restaurant's own names return.
  await useLanguage(page, 'en');
  await page.goto('/menu');
  await expect(page.getByText('Margherita D.O.C.').first()).toBeVisible();
});
