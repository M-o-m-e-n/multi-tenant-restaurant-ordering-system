import type { ModifierSnapshot } from '@ros/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface CartLine {
  /** Local identity; identical choices of the same dish merge into one line. */
  key: string;
  menuItemId: string;
  name: string;
  category: string;
  imageUrl: string | null;
  /** Cents as last seen on the menu. The server re-prices everything (PAY-07). */
  unitPrice: number;
  qty: number;
  modifiers: ModifierSnapshot[];
  notes: string;
}

export type TipChoice =
  { kind: 'none' } | { kind: 'preset'; bps: number } | { kind: 'custom'; cents: number };

/** Off-premises order type; dine-in comes only from a table QR session (AC-12). */
export type OffsiteType = 'TAKEAWAY' | 'DELIVERY';

interface CartState {
  lines: CartLine[];
  offsiteType: OffsiteType;
  setOffsiteType: (type: OffsiteType) => void;
  discountCode: string | null;
  tip: TipChoice;
  add: (line: Omit<CartLine, 'key'>) => void;
  increment: (key: string) => void;
  decrement: (key: string) => void;
  remove: (key: string) => void;
  setNotes: (key: string, notes: string) => void;
  setDiscountCode: (code: string | null) => void;
  setTip: (tip: TipChoice) => void;
  clear: () => void;
}

const MAX_QTY = 99;

/** Same dish, same options, same note → same line. */
export function lineKey(line: Pick<CartLine, 'menuItemId' | 'modifiers' | 'notes'>): string {
  const options = line.modifiers
    .flatMap((g) => g.items.map((i) => i.id))
    .sort()
    .join(',');
  return `${line.menuItemId}|${options}|${line.notes.trim().toLowerCase()}`;
}

/**
 * The cart (CART-01, CART-02). Persisted to localStorage so it survives a
 * reload and a login; it holds ids and display copies only — every price is
 * re-read by the server at preview and placement.
 */
export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      offsiteType: 'TAKEAWAY',
      setOffsiteType: (offsiteType) => set({ offsiteType }),
      discountCode: null,
      tip: { kind: 'none' },

      add: (line) =>
        set((s) => {
          const key = lineKey(line);
          const existing = s.lines.find((l) => l.key === key);
          if (existing) {
            return {
              lines: s.lines.map((l) =>
                l.key === key ? { ...l, qty: Math.min(MAX_QTY, l.qty + line.qty) } : l,
              ),
            };
          }
          return { lines: [...s.lines, { ...line, key }] };
        }),

      increment: (key) =>
        set((s) => ({
          lines: s.lines.map((l) =>
            l.key === key ? { ...l, qty: Math.min(MAX_QTY, l.qty + 1) } : l,
          ),
        })),

      // Decrementing to zero removes the line (M6-S2).
      decrement: (key) =>
        set((s) => ({
          lines: s.lines.flatMap((l) =>
            l.key !== key ? [l] : l.qty > 1 ? [{ ...l, qty: l.qty - 1 }] : [],
          ),
        })),

      remove: (key) => set((s) => ({ lines: s.lines.filter((l) => l.key !== key) })),

      setNotes: (key, notes) =>
        set((s) => ({
          lines: s.lines.map((l) => (l.key === key ? { ...l, notes: notes.slice(0, 300) } : l)),
        })),

      setDiscountCode: (discountCode) => set({ discountCode }),
      setTip: (tip) => set({ tip }),
      clear: () => set({ lines: [], discountCode: null, tip: { kind: 'none' } }),
    }),
    { name: 'ros-cart', storage: createJSONStorage(() => localStorage), version: 1 },
  ),
);

export const cartCount = (lines: readonly CartLine[]): number =>
  lines.reduce((n, l) => n + l.qty, 0);
