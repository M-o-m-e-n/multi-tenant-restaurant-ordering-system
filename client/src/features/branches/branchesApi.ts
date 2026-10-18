import type { BranchDto, UpdateBranchDto } from '@ros/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../../shared/api/client';

export const branchKeys = {
  public: ['branches'] as const,
  admin: ['admin', 'branches'] as const,
};

/** The active branches; they change rarely, so a long stale time. */
export function useBranches() {
  return useQuery({
    queryKey: branchKeys.public,
    queryFn: () => api<{ data: BranchDto[] }>('/branches').then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}

/** Every branch, inactive ones too (admin). */
export function useAdminBranches() {
  return useQuery({
    queryKey: branchKeys.admin,
    queryFn: () => api<{ data: BranchDto[] }>('/staff/branches').then((r) => r.data),
  });
}

export function useUpdateBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateBranchDto }) =>
      api<BranchDto>(`/staff/branches/${id}`, { method: 'PATCH', body }),
    onSettled: async () => {
      await qc.invalidateQueries({ queryKey: branchKeys.admin });
      await qc.invalidateQueries({ queryKey: branchKeys.public });
    },
  });
}
