import type { AdminTableDto, CreateTableDto, StaffTableDto, TableStatus } from '@ros/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../../shared/api/client';

export const tableKeys = { all: ['tables'] as const };

export type MapTable = StaffTableDto & Partial<Pick<AdminTableDto, 'qrToken' | 'qrUrl'>>;

/** The table map. Polls until M8 pushes table:changed over the socket. */
export function useTables() {
  return useQuery({
    queryKey: tableKeys.all,
    queryFn: () => api<{ data: MapTable[] }>('/tables').then((r) => r.data),
    refetchInterval: 15_000,
  });
}

function useTableMutation<T>(fn: (arg: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => qc.invalidateQueries({ queryKey: tableKeys.all }),
  });
}

export const useCloseTable = () =>
  useTableMutation((id: string) => api(`/tables/${id}/close`, { method: 'POST' }));

export const useCleanTable = () =>
  useTableMutation((id: string) => api(`/tables/${id}/clean`, { method: 'POST' }));

export const useSetTableStatus = () =>
  useTableMutation(({ id, status }: { id: string; status: TableStatus }) =>
    api(`/tables/${id}`, { method: 'PATCH', body: { status } }),
  );

export const useCreateTable = () =>
  useTableMutation((dto: CreateTableDto) => api('/tables', { method: 'POST', body: dto }));
