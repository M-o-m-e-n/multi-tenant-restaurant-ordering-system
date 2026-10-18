import 'dotenv/config';

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { PrismaClient } from '@prisma/client';

import { seedHistory } from './seed/history';
import { seedReference } from './seed/reference';
import { loadTenant, tenantId } from './seed/tenants';

const FIXTURE_PATH = fileURLToPath(new URL('./seed-fixture.json', import.meta.url));

/**
 * Demo data (HLD §9.6): accounts, the menu, tables, discounts, settings,
 * branches and 30 business days of synthetic trading, for one tenant
 * (`--tenant=<id>`; Fork & Flame by default, ADR-032). For the default
 * tenant it writes the figures it generated to seed-fixture.json so report
 * tests have an independent answer (AC-9). Wipes the database first, so it is
 * safe to re-run.
 */
async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const tenant = await loadTenant(tenantId(process.argv.slice(2), process.env));
    await wipe(prisma);
    const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);
    const refs = await seedReference(prisma, rounds, tenant);
    const days = Number(process.env.SEED_DAYS ?? 30);
    const fixture = await seedHistory(prisma, refs, tenant.settings, {
      days,
      seed: 20260925,
      ...tenant.history,
    });
    if (tenant.id === 'forkandflame') {
      writeFileSync(FIXTURE_PATH, `${JSON.stringify(fixture, null, 2)}\n`);
    }

    console.warn(
      `Seeded ${tenant.id}: ${fixture.totals.orders} in-scope orders over ${fixture.from}..${fixture.to}`,
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
    "AuditLog", "ContactMessage", "Branch", "IdempotencyKey", "WebhookEvent", "OrderSequence",
    "Payment", "Delivery", "OrderEvent", "OrderItem", "Order", "Reservation",
    "MenuItemModifierGroup", "ModifierItem", "ModifierGroup", "MenuItem", "MenuCategory",
    "Discount", "Setting", "Table", "User"
    CASCADE`;
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
