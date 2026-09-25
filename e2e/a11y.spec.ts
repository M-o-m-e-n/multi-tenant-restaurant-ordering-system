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

for (const { role, paths } of PAGES) {
  test(`axe: ${role ?? 'anonymous'} screens`, async ({ page }) => {
    if (role) await signIn(page, role);
    for (const path of paths) await audit(page, path);
  });
}

test('keyboard: the landing CTA and menu are reachable and operable without a mouse', async ({
  page,
}) => {
  await page.goto('/');
  // Tab until the first primary CTA has focus, then activate it with Enter.
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    const text = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? '');
    if (text === 'View Menu') break;
  }
  await expect(page.locator(':focus')).toHaveText('View Menu');
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
