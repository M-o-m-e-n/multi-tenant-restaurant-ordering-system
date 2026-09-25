// Public surface of the menu module (CODING-STANDARDS §5).
export { findItemsForPricing, type ItemWithGroups } from './menu.repo';
export { publicMenuRouter, staffMenuRouter } from './menu.routes';
export {
  getPublicMenu,
  menuChanged,
  type ResolvedSelection,
  resolveSelections,
  unavailableItems,
} from './menu.service';
