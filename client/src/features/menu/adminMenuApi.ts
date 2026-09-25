import type {
  AdminMenuDto,
  CreateCategoryDto,
  CreateItemDto,
  MenuItemDto,
  UpdateCategoryDto,
  UpdateItemDto,
} from '@ros/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../../shared/api/client';
import { menuKeys } from './menuApi';

const adminKey = ['admin', 'menu'] as const;

export function useAdminMenu() {
  return useQuery({ queryKey: adminKey, queryFn: () => api<AdminMenuDto>('/staff/menu') });
}

/** Every admin write refreshes both the admin view and the public menu. */
function useMenuMutation<TArgs>(fn: (args: TArgs) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: adminKey }),
        qc.invalidateQueries({ queryKey: menuKeys.menu }),
      ]);
    },
  });
}

export function useSetAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) =>
      api<MenuItemDto>(`/staff/menu/items/${id}/availability`, {
        method: 'PATCH',
        body: { isAvailable },
      }),
    // Optimistic: the toggle flips at once and rolls back if the server refuses.
    onMutate: async ({ id, isAvailable }) => {
      await qc.cancelQueries({ queryKey: adminKey });
      const previous = qc.getQueryData<AdminMenuDto>(adminKey);
      if (previous) {
        qc.setQueryData<AdminMenuDto>(adminKey, {
          ...previous,
          categories: previous.categories.map((c) => ({
            ...c,
            items: c.items.map((i) => (i.id === id ? { ...i, isAvailable } : i)),
          })),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(adminKey, ctx.previous);
    },
    onSettled: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: adminKey }),
        qc.invalidateQueries({ queryKey: menuKeys.menu }),
      ]);
    },
  });
}

export const useCreateItem = () =>
  useMenuMutation((dto: CreateItemDto) => api('/staff/menu/items', { method: 'POST', body: dto }));

export const useUpdateItem = () =>
  useMenuMutation(({ id, dto }: { id: string; dto: UpdateItemDto }) =>
    api(`/staff/menu/items/${id}`, { method: 'PATCH', body: dto }),
  );

export const useDeleteItem = () =>
  useMenuMutation((id: string) => api(`/staff/menu/items/${id}`, { method: 'DELETE' }));

export const useCreateCategory = () =>
  useMenuMutation((dto: CreateCategoryDto) =>
    api('/staff/menu/categories', { method: 'POST', body: dto }),
  );

export const useUpdateCategory = () =>
  useMenuMutation(({ id, dto }: { id: string; dto: UpdateCategoryDto }) =>
    api(`/staff/menu/categories/${id}`, { method: 'PATCH', body: dto }),
  );

export const useDeleteCategory = () =>
  useMenuMutation((id: string) => api(`/staff/menu/categories/${id}`, { method: 'DELETE' }));
