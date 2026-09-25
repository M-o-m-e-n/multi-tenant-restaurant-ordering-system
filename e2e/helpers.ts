import { type APIRequestContext, expect, type Page } from '@playwright/test';

export const API = 'http://localhost:4000/api/v1';
export const PASSWORD = 'password123';
export const USERS = {
  admin: 'admin@forkandflame.test',
  staff: 'staff@forkandflame.test',
  guest: 'guest@forkandflame.test',
} as const;
export type Role = keyof typeof USERS;

/** Sign in through the real form, as a person would. */
export async function signIn(page: Page, role: Role, then?: string): Promise<void> {
  await page.goto(then ? `/login?returnTo=${encodeURIComponent(then)}` : '/login');
  await page.getByLabel('Email').fill(USERS[role]);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

/** A bearer token for setting up state through the API. */
export async function token(request: APIRequestContext, role: Role): Promise<string> {
  const res = await request.post(`${API}/auth/login`, {
    data: { email: USERS[role], password: PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
  return ((await res.json()) as { accessToken: string }).accessToken;
}

export async function api<T>(
  request: APIRequestContext,
  bearer: string,
  method: 'get' | 'post' | 'patch' | 'put',
  path: string,
  data?: unknown,
): Promise<T> {
  const res = await request.fetch(`${API}${path}`, {
    method: method.toUpperCase(),
    headers: { Authorization: `Bearer ${bearer}` },
    ...(data === undefined ? {} : { data }),
  });
  expect(res.ok(), `${method} ${path} → ${res.status()} ${await res.text()}`).toBeTruthy();
  return (await res.json()) as T;
}

interface MenuDto {
  categories: { items: { id: string; name: string }[] }[];
}

export async function menuItemId(request: APIRequestContext, name: string): Promise<string> {
  const menu = (await (await request.get(`${API}/menu`)).json()) as MenuDto;
  const item = menu.categories.flatMap((c) => c.items).find((i) => i.name === name);
  if (!item) throw new Error(`no dish named ${name}`);
  return item.id;
}

/** Parse "$12.34" (or "−$1.00") into integer cents. */
export function cents(text: string): number {
  const negative = /[−-]/.test(text);
  const digits = text.replace(/[^0-9.]/g, '');
  const [whole = '0', frac = '0'] = digits.split('.');
  const value = Number(whole) * 100 + Number(frac.padEnd(2, '0').slice(0, 2));
  return negative ? -value : value;
}

/** The amount in a cart/summary row, by its label. */
export async function rowCents(page: Page, label: string): Promise<number> {
  const row = page
    .locator('dl div')
    .filter({ has: page.locator('dt', { hasText: new RegExp(`^${label}$`) }) });
  return cents(await row.locator('dd').first().innerText());
}
