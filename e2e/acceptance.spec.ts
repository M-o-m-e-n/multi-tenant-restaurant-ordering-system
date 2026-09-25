import { expect, test } from '@playwright/test';

import { api, cents, rowCents, signIn, token } from './helpers';

/** SRS §9 criteria that only a browser can prove (M13-S13). */

interface TableRow {
  id: string;
  number: string;
  status: string;
  qrToken: string;
}

async function freeTable(request: Parameters<typeof token>[0]): Promise<TableRow> {
  const admin = await token(request, 'admin');
  const { data } = await api<{ data: TableRow[] }>(request, admin, 'get', '/tables');
  const table = data.find((t) => t.status === 'FREE');
  if (!table) throw new Error('no free table');
  return table;
}

test('AC-1: QR → modifiers → hand-checked total → login → on the KDS within 500 ms', async ({
  page,
  browser,
  request,
}) => {
  const table = await freeTable(request);

  const kitchenContext = await browser.newContext();
  const kitchen = await kitchenContext.newPage();
  await signIn(kitchen, 'staff', '/kitchen');
  await expect(kitchen.getByText(/Live$/)).toBeVisible();

  // Scan the table code while signed out: the menu is bound to that table.
  await page.goto(`/t/${table.qrToken}`);
  await expect(page).toHaveURL(/\/menu$/);
  await expect(page.getByText(`Table ${table.number}`).first()).toBeVisible();

  await page.getByRole('button', { name: 'Add Wagyu Burger' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('label', { hasText: 'Large' }).click();
  await expect(dialog.getByLabel(/Large/)).toBeChecked();
  await dialog.getByRole('button', { name: /^Add · \$/ }).click();

  // Hand calculation (dine-in): 1850 + 400 = 2250; service 10% = 225;
  // tax 8.75% of 2250 = 196.875 → 197 (half away from zero); total 2672.
  await page.goto('/cart');
  await expect(page.getByText('✓ Prices confirmed')).toBeVisible();
  expect(await rowCents(page, 'Subtotal')).toBe(2250);
  expect(await rowCents(page, 'Service charge')).toBe(225);
  expect(await rowCents(page, 'Tax')).toBe(197);
  const totalText = await page
    .locator('dl div')
    .filter({ hasText: /^Total/ })
    .locator('dd')
    .innerText();
  expect(cents(totalText)).toBe(2672);

  await page.getByRole('link', { name: 'Checkout' }).click();
  await page.getByLabel('Email').fill('guest@forkandflame.test');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/checkout$/);

  const created = page.waitForResponse(
    (r) => r.url().endsWith('/api/v1/orders') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: /^Place order/ }).click();
  const response = await created;
  const committedAt = Date.now();
  const order = (await response.json()) as { orderNumber: string; totals: { total: number } };
  expect(order.totals.total).toBe(2672);

  await kitchen
    .getByRole('article', { name: new RegExp(`^Order ${order.orderNumber},`) })
    .waitFor({ state: 'visible', timeout: 5_000 });
  const latency = Date.now() - committedAt;
  test.info().annotations.push({ type: 'KDS latency', description: `${latency} ms` });
  expect(latency).toBeLessThan(500);
  await kitchenContext.close();
});

test("AC-2: the customer's tracker follows every kitchen step live", async ({ page, request }) => {
  const table = await freeTable(request);
  await signIn(page, 'guest');
  await page.goto(`/t/${table.qrToken}`);
  await page.getByRole('button', { name: 'Add Yuzu Lemonade' }).first().click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Add · \$/ })
    .click();
  await page.goto('/checkout');
  await page.getByRole('button', { name: /^Place order/ }).click();
  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/);
  const orderId = page.url().split('/').pop() ?? '';
  const status = page.locator('p[aria-live="polite"]').first();
  await expect(status).toHaveText('Order received');

  const staff = await token(request, 'staff');
  const steps: [string, string][] = [
    ['CONFIRMED', 'Confirmed'],
    ['PREPARING', 'Being prepared'],
    ['READY', 'Ready'],
    ['SERVED', 'Served'],
    ['COMPLETED', 'Completed'],
  ];
  for (const [to, label] of steps) {
    await api(request, staff, 'patch', `/orders/${orderId}/status`, { to });
    // No reload: the socket event drives the refetch.
    await expect(status).toHaveText(label, { timeout: 3_000 });
  }
});

test('AC-22: no token is reachable from page script or browser storage', async ({
  page,
  context,
}) => {
  await signIn(page, 'guest', '/orders');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();

  const exposed = await page.evaluate(() => {
    const values: string[] = [document.cookie];
    for (const store of [localStorage, sessionStorage]) {
      for (let i = 0; i < store.length; i++) {
        const key = store.key(i) ?? '';
        values.push(key, store.getItem(key) ?? '');
      }
    }
    return values.join('\n');
  });
  // No JWT (eyJ…) and no refresh cookie value is visible to script.
  expect(exposed).not.toMatch(/eyJ[\w-]+\.[\w-]+\./);
  const cookies = await context.cookies();
  const refresh = cookies.filter((c) => c.path.startsWith('/api/v1/auth'));
  expect(refresh.length).toBeGreaterThan(0);
  for (const c of refresh) {
    expect(c.httpOnly).toBe(true);
    expect(c.sameSite).toBe('Strict');
    expect(exposed).not.toContain(c.value);
  }
});
