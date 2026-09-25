import 'dotenv/config';

import { PrismaClient } from '@prisma/client';

import { seedReference } from './seed/reference';

/**
 * Demo data (HLD §9.6): accounts, the menu, tables, discounts and settings.
 * Wipes the database first, so it is safe to re-run.
 */
async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    await wipe(prisma);
    const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);
    const { tables } = await seedReference(prisma, rounds);

    console.warn('Seeded reference data. Table QR tokens:');
    for (const t of tables) console.warn(`  table ${t.number.padStart(2)}  /t/${t.qrToken}`);
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
