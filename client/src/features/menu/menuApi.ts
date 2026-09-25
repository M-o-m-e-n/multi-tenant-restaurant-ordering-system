import type { MenuDto, MenuItemDto } from '@ros/shared';
import { useQuery } from '@tanstack/react-query';

import { api } from '../../shared/api/client';

export const menuKeys = {
  menu: ['menu'] as const,
  item: (id: string) => ['menu', 'item', id] as const,
};

/** The public menu. Socket `menu:changed` invalidates this key from M8 on. */
export function useMenu() {
  return useQuery({
    queryKey: menuKeys.menu,
    queryFn: () => api<MenuDto>('/menu', { anonymous: true }),
  });
}

export function useMenuItem(id: string | null) {
  return useQuery({
    queryKey: menuKeys.item(id ?? 'none'),
    queryFn: () => api<MenuItemDto>(`/menu/items/${id ?? ''}`, { anonymous: true }),
    enabled: id !== null,
  });
}
