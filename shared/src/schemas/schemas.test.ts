import { describe, expect, it } from 'vitest';

import { registerSchema } from './auth';
import { normalizePhone, phoneNumber } from './common';
import { updateItemSchema } from './menu';
import { updateDeliverySchema } from './orders';
import { createOrderSchema, listOrdersQuerySchema, previewOrderSchema } from './orders';
import {
  createReservationSchema,
  isReservationOverdue,
  updateReservationSchema,
} from './reservations';

const itemId = '6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b';

describe('schemas', () => {
  it('needs a driver or a status to update a delivery', () => {
    expect(updateDeliverySchema.safeParse({}).success).toBe(false);
    expect(updateDeliverySchema.safeParse({ driverName: 'Ali' }).success).toBe(true);
    expect(updateDeliverySchema.safeParse({ status: 'PICKED_UP' }).success).toBe(true);
  });

  it('validates reservations and their seat/cancel actions', () => {
    const base = {
      guestName: 'Ava',
      guestPhone: '+15550100',
      partySize: 4,
      slotAt: '2026-10-01T19:30:00-04:00',
    };
    expect(createReservationSchema.safeParse(base).success).toBe(true);
    expect(createReservationSchema.safeParse({ ...base, partySize: 0 }).success).toBe(false);
    expect(createReservationSchema.safeParse({ ...base, slotAt: 'tonight' }).success).toBe(false);
    expect(updateReservationSchema.safeParse({ action: 'seat' }).success).toBe(true);
    expect(
      updateReservationSchema.safeParse({ action: 'cancel', tableId: base.slotAt }).success,
    ).toBe(false);
    expect(updateReservationSchema.safeParse({ action: 'complete' }).success).toBe(false);
  });

  it('flags a pending booking only after the 15-minute grace', () => {
    const slotAt = '2026-10-01T19:30:00Z';
    const at = (iso: string) => new Date(iso);
    expect(isReservationOverdue({ status: 'PENDING', slotAt }, at('2026-10-01T19:45:00Z'))).toBe(
      false,
    );
    expect(isReservationOverdue({ status: 'PENDING', slotAt }, at('2026-10-01T19:45:01Z'))).toBe(
      true,
    );
    expect(isReservationOverdue({ status: 'SEATED', slotAt }, at('2026-10-01T23:00:00Z'))).toBe(
      false,
    );
  });

  it('accepts http(s) and same-origin image paths but no other scheme', () => {
    const ok = (imageUrl: string) => updateItemSchema.safeParse({ imageUrl }).success;
    expect(ok('https://cdn.example.com/a.jpg')).toBe(true);
    expect(ok('/images/dishes/wagyu-burger.jpg')).toBe(true);
    expect(ok('javascript:alert(1)')).toBe(false);
    expect(ok('//evil.example.com/a.jpg')).toBe(false);
    expect(ok('data:image/png;base64,AAAA')).toBe(false);
  });

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

describe('phone numbers (M14-S9)', () => {
  it('stores Egyptian mobiles written locally in international form', () => {
    expect(normalizePhone('010 1362 2622')).toBe('+201013622622');
    expect(normalizePhone('0111-547-8747')).toBe('+201115478747');
    expect(normalizePhone('00201050086850')).toBe('+201050086850');
    expect(normalizePhone('+1 (555) 014-2')).toBe('+15550142');
  });

  it('accepts reachable numbers and refuses junk', () => {
    const ok = (p: string) => phoneNumber.safeParse(p).success;
    expect(ok('01013622622')).toBe(true);
    expect(ok('+15550142')).toBe(true);
    expect(ok('12345')).toBe(false);
    expect(ok('01913622622')).toBe(false);
    expect(ok('call me')).toBe(false);
  });
});
