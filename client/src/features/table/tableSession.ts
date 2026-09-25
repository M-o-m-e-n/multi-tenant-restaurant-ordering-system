import type { TableSummaryDto } from '@ros/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface TableSessionState {
  /** The QR token, never a table id: the server resolves the table from it (AC-12). */
  token: string | null;
  table: Pick<TableSummaryDto, 'number' | 'seats'> | null;
  join: (token: string, table: TableSummaryDto) => void;
  leave: () => void;
}

/**
 * The dine-in context for this browser tab (LLD §7.2): kept in sessionStorage
 * so a reload keeps the table, while a new tab or a new visit starts clean.
 */
export const useTableSession = create<TableSessionState>()(
  persist(
    (set) => ({
      token: null,
      table: null,
      join: (token, table) => set({ token, table: { number: table.number, seats: table.seats } }),
      leave: () => set({ token: null, table: null }),
    }),
    { name: 'ros-table', storage: createJSONStorage(() => sessionStorage) },
  ),
);
