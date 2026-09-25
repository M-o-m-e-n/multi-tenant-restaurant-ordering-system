import type {
  Breakdowns,
  Cancellations,
  DashboardToday,
  PeakHour,
  RevenueDay,
  SalesSummary,
  TopItem,
} from '@ros/shared';
import { useQuery } from '@tanstack/react-query';

import { api } from '../../shared/api/client';

/** Under ['orders', …] so order and payment socket events refresh it. */
export function useDashboard() {
  return useQuery({
    queryKey: ['orders', 'dashboard'],
    queryFn: () => api<DashboardToday>('/dashboard/today'),
    refetchInterval: 60_000,
  });
}

export interface Range {
  from: string;
  to: string;
}

export interface ReportBundle {
  summary: SalesSummary;
  byDay: RevenueDay[];
  top: TopItem[];
  peak: PeakHour[];
  breakdowns: Breakdowns;
  cancellations: Cancellations;
}

export function useReports(range: Range | null) {
  return useQuery({
    queryKey: ['reports', range],
    enabled: range !== null,
    queryFn: async (): Promise<ReportBundle> => {
      if (!range) throw new Error('no range');
      const q = `from=${range.from}&to=${range.to}`;
      const [summary, byDay, top, peak, breakdowns, cancellations] = await Promise.all([
        api<SalesSummary>(`/reports/summary?${q}`),
        api<{ data: RevenueDay[] }>(`/reports/revenue-by-day?${q}`).then((r) => r.data),
        api<{ data: TopItem[] }>(`/reports/top-items?${q}&limit=10&metric=qty`).then((r) => r.data),
        api<{ data: PeakHour[] }>(`/reports/peak-hours?${q}`).then((r) => r.data),
        api<Breakdowns>(`/reports/breakdowns?${q}`),
        api<Cancellations>(`/reports/cancellations?${q}`),
      ]);
      return { summary, byDay, top, peak, breakdowns, cancellations };
    },
  });
}

/** Add whole days to a `YYYY-MM-DD` business date. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** RFC 4180 CSV, for the report export (RPT-07). Money columns are exported in cents. */
export function toCsv(rows: Record<string, string | number | null>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0] ?? {});
  const cell = (v: string | number | null) => {
    const s = v === null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => cell(r[h] ?? null)).join(',')),
  ].join('\n');
}
