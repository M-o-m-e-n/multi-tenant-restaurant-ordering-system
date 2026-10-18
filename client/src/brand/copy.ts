import { tenant } from '@tenant';

/**
 * Tenant copy used outside the landing page (ADR-029/030). The landing's own
 * copy lives with each tenant's landing; all of it swaps with the tenant.
 */
export const MENU_BANNER = tenant.copy.menuBanner;
export const MENU_PHOTO = tenant.copy.menuPhoto;
export const RESERVE_PANEL = tenant.copy.reservePanel;
