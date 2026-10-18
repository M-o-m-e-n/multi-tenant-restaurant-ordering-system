import { tenant } from '@tenant';

import type { Brand } from './types';

export type { Brand, BrandCopy, PageLoader, Tenant, ThemeName } from './types';

/**
 * The built tenant's brand (ADR-032). One deployment serves one restaurant,
 * chosen at build time with VITE_TENANT; see brand/types.ts.
 */
export const brand: Brand = tenant.brand;
export { tenant };
