import type { DeliveryStatus } from '@ros/shared';

import { tNow } from '../../i18n';

/** What each delivery step means, in words (never colour alone, NFR-U3). */
export const deliveryLabel = (status: DeliveryStatus): string => tNow().delivery[status];
