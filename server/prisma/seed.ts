import 'dotenv/config';

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { PrismaClient } from '@prisma/client';
import { DEFAULT_SETTINGS } from '@ros/shared';

import { seedHistory } from './seed/history';
import { seedReference } from './seed/reference';

const FIXTURE_PATH = fileURLToPath(new URL('./seed-fixture.json', import.meta.url));

/**
 * Demo data (HLD §9.6): accounts, the menu, tables, discounts, settings and
 * 30 business days of synthetic trading. Writes the figures it generated to
 * seed-fixture.json so report tests have an independent answer (AC-9).
 * Wipes the database first, so it is safe to re-run.
 */
async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    await wipe(prisma);
    const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);
    const refs = await seedReference(prisma, rounds);
    const days = Number(process.env.SEED_DAYS ?? 30);
    const fixture = await seedHistory(prisma, refs, DEFAULT_SETTINGS, { days, seed: 20260925 });
    writeFileSync(FIXTURE_PATH, `${JSON.stringify(fixture, null, 2)}\n`);

    console.warn(
      `Seeded ${fixture.totals.orders} in-scope orders over ${fixture.from}..${fixture.to}; fixture at ${FIXTURE_PATH}`,
    );
    console.warn('Table QR tokens:');
    for (const t of refs.tables) console.warn(`  table ${t.number.padStart(2)}  /t/${t.qrToken}`);
  } finally {
    await prisma.$disconnect();
  }
}

async function wipe(prisma: PrismaClient): Promise<void> {
  // Fixed identifier list, no values: safe as a tagged template (NFR-S6).
  await prisma.$executeRaw`TRUNCATE TABLE
    "AuditLog", "IdempotencyKey", "WebhookEvent", "OrderSequence", "Payment", "Delivery",
    "OrderEvent", "OrderItem", "Order", "Reservation", "MenuItemModifierGroup", "ModifierItem",
    "ModifierGroup", "MenuItem", "MenuCategory", "Discount", "Setting", "Table", "User"
    CASCADE`;
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
