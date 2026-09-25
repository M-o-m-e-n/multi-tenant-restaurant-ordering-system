import { PrismaClient } from '@prisma/client';

let client: PrismaClient | undefined;

/** The process-wide Prisma client, created on first use. */
export function prisma(): PrismaClient {
  client ??= new PrismaClient();
  return client;
}

/** Transaction client type for functions that must run inside `$transaction`. */
export type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

export async function disconnectPrisma(): Promise<void> {
  if (client) {
    await client.$disconnect();
    client = undefined;
  }
}
