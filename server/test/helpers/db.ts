import { prisma } from '../../src/lib/prisma';

/** Empty every table between tests. Fixed identifier list, no values (NFR-S6). */
export async function resetDb(): Promise<void> {
  await prisma().$executeRaw`TRUNCATE TABLE
    "AuditLog", "ContactMessage", "Branch", "IdempotencyKey", "WebhookEvent", "OrderSequence", "Payment", "Delivery",
    "OrderEvent", "OrderItem", "Order", "Reservation", "MenuItemModifierGroup", "ModifierItem",
    "ModifierGroup", "MenuItem", "MenuCategory", "Discount", "Setting", "Table", "User"
    CASCADE`;
}
