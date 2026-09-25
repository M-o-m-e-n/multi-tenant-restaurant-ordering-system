import { describe, expect, it } from 'vitest';

import { registerSchema } from './auth';
import { createOrderSchema, listOrdersQuerySchema, previewOrderSchema } from './orders';

const itemId = '6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b';

describe('schemas', () => {
  it('rejects unknown fields rather than stripping them (NFR-S5)', () => {
    const result = previewOrderSchema.safeParse({ type: 'TAKEAWAY', items: [], total: 1 });
    expect(result.success).toBe(false);
  });

  it('rejects a tableId in the order body so the table only comes from the token (AC-12)', () => {
    const result = createOrderSchema.safeParse({
      type: 'DINE_IN',
      tableToken: 'a'.repeat(32),
      tableId: itemId,
      items: [{ menuItemId: itemId, qty: 1 }],
    });
    expect(result.success).toBe(false);
  });

  it('requires a table token for dine-in and contact details for takeaway', () => {
    expect(createOrderSchema.safeParse({ type: 'DINE_IN', items: [] }).success).toBe(false);
    expect(createOrderSchema.safeParse({ type: 'TAKEAWAY', items: [] }).success).toBe(false);
    expect(
      createOrderSchema.safeParse({
        type: 'TAKEAWAY',
        customer: { name: 'Jane', phone: '+15550142' },
        items: [],
      }).success,
    ).toBe(true);
  });

  it('refuses a fractional tip', () => {
    const result = previewOrderSchema.safeParse({ type: 'TAKEAWAY', items: [], tipAmount: 1.5 });
    expect(result.success).toBe(false);
  });

  it('lower-cases the registration email', () => {
    const dto = registerSchema.parse({
      name: 'Jane',
      email: 'Jane@Example.COM',
      password: 'x'.repeat(8),
    });
    expect(dto.email).toBe('jane@example.com');
  });

  it('reads repeated status query params as an array', () => {
    const q = listOrdersQuerySchema.parse({ status: ['PLACED', 'READY'], page: '2' });
    expect(q.status).toEqual(['PLACED', 'READY']);
    expect(q.page).toBe(2);
    expect(listOrdersQuerySchema.parse({ status: 'PLACED' }).status).toEqual(['PLACED']);
  });
});
