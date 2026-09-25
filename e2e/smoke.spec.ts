import { expect, test } from '@playwright/test';

import { API, api, cents, menuItemId, rowCents, signIn, token } from './helpers';

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  balanceDue: number;
  totals: { total: number };
}

/** LLD §10.3 scenario 1: menu → modifier → cart total → login → order → tracker. */
test('1. a guest orders a configured dish and lands on the live tracker', async ({
  page,
  request,
}) => {
  await page.goto('/menu');
  await page.getByRole('button', { name: 'Add Wagyu Burger' }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Doneness')).toBeVisible();
  await dialog.getByRole('button', { name: /^Add · \$/ }).click();
  await expect(dialog).toBeHidden();

  await page.goto('/cart');
  await expect(page.getByText('✓ Prices confirmed')).toBeVisible();
  const subtotal = await rowCents(page, 'Subtotal');
  const tax = await rowCents(page, 'Tax');
  const total = cents(
    await page
      .locator('dl div')
      .filter({ hasText: /^Total/ })
      .locator('dd')
      .innerText(),
  );
  expect(subtotal).toBe(1850);
  expect(total).toBeGreaterThanOrEqual(subtotal + tax);

  await page.getByRole('link', { name: 'Checkout' }).click();
  await expect(page).toHaveURL(/\/login\?returnTo=/);
  await page.getByLabel('Email').fill('guest@forkandflame.test');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/checkout$/);

  await page.getByLabel('Phone').fill('+15550142');
  await page.getByRole('button', { name: /^Place order/ }).click();
  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name: /^Order A-\d+$/ })).toBeVisible();
  await expect(page.getByText('Order received').first()).toBeVisible();

  const config = (await (await request.get(`${API}/payments/config`)).json()) as {
    enabled: boolean;
  };
  test.info().annotations.push({
    type: 'card payment',
    description: config.enabled
      ? 'Stripe test keys present'
      : 'Skipped: no Stripe test keys in this environment; card flow is covered offline by payments.test.ts',
  });
});

/** Scenario 2: a new ticket reaches the KDS and is bumped to completion. */
test('2. staff see a new ticket on the KDS within a moment and bump it through', async ({
  page,
  request,
}) => {
  await signIn(page, 'staff', '/kitchen');
  await expect(page).toHaveURL(/\/kitchen$/);
  // "● Live": the dot is aria-hidden, so match the end of the text.
  await expect(page.getByText(/Live$/)).toBeVisible();

  const guest = await token(request, 'guest');
  const placedAt = Date.now();
  const order = await api<Order>(request, guest, 'post', '/orders', {
    type: 'TAKEAWAY',
    customer: { name: 'KDS Test', phone: '+15550100' },
    items: [{ menuItemId: await menuItemId(request, 'Yuzu Lemonade'), qty: 1 }],
  });
  const ticket = page.getByRole('article', { name: new RegExp(`^Order ${order.orderNumber},`) });
  await expect(ticket).toBeVisible({ timeout: 5_000 });
  const latency = Date.now() - placedAt;
  test.info().annotations.push({ type: 'ticket latency', description: `${latency} ms` });

  const staff = await token(request, 'staff');
  for (let i = 0; i < 6; i++) {
    const current = await api<Order>(request, staff, 'get', `/orders/${order.id}`);
    if (current.status === 'COMPLETED') break;
    await ticket.getByRole('button', { name: /→$/ }).click();
    await expect
      .poll(async () => (await api<Order>(request, staff, 'get', `/orders/${order.id}`)).status)
      .not.toBe(current.status);
  }
  expect((await api<Order>(request, staff, 'get', `/orders/${order.id}`)).status).toBe('COMPLETED');
});

/** Scenario 3: 86'ing a dish shows as sold out on an open customer menu, live. */
test("3. an admin 86's a dish and an open customer menu shows it sold out", async ({
  page,
  browser,
}) => {
  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();
  await guestPage.goto('/menu');
  const row = guestPage.getByRole('listitem').filter({ hasText: 'Tiramisu' }).last();
  await expect(row.getByRole('button', { name: 'Add Tiramisu' })).toBeVisible();

  await signIn(page, 'admin', '/admin/menu');
  const toggle = page.getByRole('switch', { name: 'Tiramisu available' });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');

  await expect(row.getByText('Sold out')).toBeVisible({ timeout: 5_000 });
  await expect(row.getByRole('button', { name: 'Add Tiramisu' })).toHaveCount(0);

  await toggle.click();
  await expect(row.getByRole('button', { name: 'Add Tiramisu' })).toBeVisible({ timeout: 5_000 });
  await guestContext.close();
});

/** Scenario 4: the report page shows the same figures as the reports API. */
test('4. the admin report matches the API for the seeded range', async ({ page, request }) => {
  const admin = await token(request, 'admin');
  const today = await api<{ businessDate: string }>(request, admin, 'get', '/dashboard/today');
  const to = today.businessDate;
  const from = new Date(Date.parse(`${to}T00:00:00Z`) - 29 * 86_400_000).toISOString().slice(0, 10);
  const summary = await api<{ netSales: number; orders: number }>(
    request,
    admin,
    'get',
    `/reports/summary?from=${from}&to=${to}`,
  );
  expect(summary.orders).toBeGreaterThan(0);

  await signIn(page, 'admin', '/admin/reports');
  const tile = (label: string) =>
    page
      .locator('div')
      .filter({ has: page.locator('p', { hasText: new RegExp(`^${label}$`) }) })
      .last();
  await expect(tile('Net sales').locator('p').nth(1)).toHaveText(
    `$${(summary.netSales / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
  );
  await expect(tile('Orders').locator('p').nth(1)).toHaveText(String(summary.orders));
});

/** Scenario 5: a tip raises the total by exactly the tip, leaves tax alone, and is on the receipt. */
test('5. a tip adds exactly its amount, never touches tax, and prints on the receipt', async ({
  page,
}) => {
  await signIn(page, 'guest', '/menu');
  await page.getByRole('button', { name: 'Add Margherita D.O.C.' }).first().click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Add · \$/ })
    .click();
  await page.goto('/cart');
  await expect(page.getByText('✓ Prices confirmed')).toBeVisible();

  const totalRow = page
    .locator('dl div')
    .filter({ hasText: /^Total/ })
    .locator('dd');
  const taxBefore = await rowCents(page, 'Tax');
  const totalBefore = cents(await totalRow.innerText());

  await page.getByRole('button', { name: /^15%/ }).click();
  await expect(page.getByText('✓ Prices confirmed')).toBeVisible();
  const tip = await rowCents(page, 'Tip');
  expect(tip).toBeGreaterThan(0);
  expect(await rowCents(page, 'Tax')).toBe(taxBefore);
  expect(cents(await totalRow.innerText())).toBe(totalBefore + tip);

  await page.getByRole('link', { name: 'Checkout' }).click();
  await page.getByLabel('Phone').fill('+15550142');
  await page.getByRole('button', { name: /^Place order/ }).click();
  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/);

  await page.getByRole('link', { name: 'Receipt' }).click();
  for (const label of ['Subtotal', 'Tax', 'Tip', 'Total']) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }
  await expect(page.getByText(`$${(tip / 100).toFixed(2)}`).first()).toBeVisible();
});

/** Scenario 6: dine-in, paid, then a second round: KDS badge, PARTIALLY_PAID, settled by cash. */
test('6. a paid dine-in order takes a second round and is settled in cash', async ({
  page,
  browser,
  request,
}) => {
  const admin = await token(request, 'admin');
  const staff = await token(request, 'staff');
  const tables = await api<{
    data: { id: string; number: string; status: string; qrToken: string }[];
  }>(request, admin, 'get', '/tables');
  const table = tables.data.find((t) => t.status === 'FREE');
  if (!table) throw new Error('no free table in the seed');

  // The guest scans the table QR and orders.
  await signIn(page, 'guest');
  await page.goto(`/t/${table.qrToken}`);
  await expect(page).toHaveURL(/\/menu$/);
  await page.getByRole('button', { name: 'Add Truffle Arancini' }).first().click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Add · \$/ })
    .click();
  await page.goto('/checkout');
  await expect(page.getByText(`Table ${table.number}`)).toBeVisible();
  await page.getByRole('button', { name: /^Place order/ }).click();
  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/);
  const orderId = page.url().split('/').pop() ?? '';

  // Staff take the full balance in cash.
  const first = await api<Order>(request, staff, 'get', `/orders/${orderId}`);
  await api(request, staff, 'post', '/payments/cash', { orderId, amount: first.balanceDue });
  await expect(page.getByText('Paid', { exact: true })).toBeVisible();

  // The kitchen board is open while the guest adds a second round.
  const kitchenContext = await browser.newContext();
  const kitchen = await kitchenContext.newPage();
  await signIn(kitchen, 'staff', '/kitchen');
  const ticket = kitchen.getByRole('article', { name: new RegExp(`^Order ${first.orderNumber},`) });
  await expect(ticket).toBeVisible();

  await page.getByRole('button', { name: '+ Add to this order' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /^Tiramisu/ }).click();
  await page
    .getByRole('dialog')
    .last()
    .getByRole('button', { name: /^Add · \$/ })
    .click();
  await dialog.getByRole('button', { name: /to the order$/ }).click();
  await expect(page.getByText('Partly paid')).toBeVisible();

  await expect(ticket.getByText(/Later round/)).toBeVisible({ timeout: 5_000 });
  await kitchenContext.close();

  // Settle the new balance at the till.
  await signIn(page, 'staff', '/pos');
  await page.getByRole('button', { name: new RegExp(`^${first.orderNumber}`) }).click();
  await page.getByRole('button', { name: 'Take cash' }).click();
  await page.getByRole('button', { name: 'Record cash payment' }).click();
  await expect
    .poll(async () => (await api<Order>(request, staff, 'get', `/orders/${orderId}`)).paymentStatus)
    .toBe('PAID');
});
