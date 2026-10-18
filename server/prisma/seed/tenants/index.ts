import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { DEFAULT_SETTINGS } from '@ros/shared';

import { buildMenu, DEMO_USERS } from '../reference';
import type { SeedTenant } from './types';

export type { SeedBranch, SeedTenant } from './types';

/** The portfolio demo, and the default for every test and E2E run. */
export const forkandflame: SeedTenant = {
  id: 'forkandflame',
  settings: DEFAULT_SETTINGS,
  users: DEMO_USERS,
  buildMenu,
  branches: [],
  tableCount: 14,
};

/** Private tenant packs are checked out here, outside the public tree (tenants/README.md). */
const PACKS = fileURLToPath(new URL('../../../../tenants/', import.meta.url));

/** `--tenant=<id>` on the command line, else SEED_TENANT, else Fork & Flame. */
export function tenantId(argv: string[], env: NodeJS.ProcessEnv): string {
  const flag = argv.find((a) => a.startsWith('--tenant='))?.slice('--tenant='.length);
  return flag ?? env.SEED_TENANT ?? 'forkandflame';
}

/** The tenant to seed: Fork & Flame, or the pack at tenants/<id>/server/index.ts. */
export async function loadTenant(id: string): Promise<SeedTenant> {
  if (id === 'forkandflame') return forkandflame;
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`Invalid tenant id "${id}"`);
  const entry = `${PACKS}${id}/server/index.ts`;
  if (!existsSync(entry)) {
    throw new Error(`Tenant "${id}" not found: expected its pack at ${entry}`);
  }
  const pack = (await import(pathToFileURL(entry).href)) as { tenant?: SeedTenant };
  if (!pack.tenant) throw new Error(`${entry} must export \`tenant\``);
  return pack.tenant;
}
