import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import * as shared from '@ros/shared';
import { describe, expect, it } from 'vitest';

// Prisma enums and shared enums must have identical members (M2-S2).
const schema = readFileSync(
  fileURLToPath(new URL('../prisma/schema.prisma', import.meta.url)),
  'utf8',
);

function prismaEnum(name: string): string[] {
  const match = new RegExp(`enum ${name} [{]([^}]*)[}]`).exec(schema);
  if (!match?.[1]) throw new Error(`enum ${name} not found in schema.prisma`);
  return match[1]
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

const pairs: [string, readonly string[]][] = [
  ['Role', shared.ROLES],
  ['OrderType', shared.ORDER_TYPES],
  ['OrderStatus', shared.ORDER_STATUSES],
  ['PaymentStatus', shared.PAYMENT_STATUSES],
  ['PaymentState', shared.PAYMENT_STATES],
  ['PaymentMethod', shared.PAYMENT_METHODS],
  ['TableStatus', shared.TABLE_STATUSES],
  ['DiscountType', shared.DISCOUNT_TYPES],
  ['DeliveryStatus', shared.DELIVERY_STATUSES],
  ['ReservationStatus', shared.RESERVATION_STATUSES],
];

describe('prisma enum parity', () => {
  it.each(pairs)('%s matches the shared enum', (name, members) => {
    expect(prismaEnum(name)).toEqual([...members]);
  });
});
