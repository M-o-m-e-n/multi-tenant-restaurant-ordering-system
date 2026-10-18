import type { MenuDto, MenuItemDto } from '@ros/shared';
import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useLang } from '../../i18n';
import { api } from '../../shared/api/client';
import { localizeItem, localizeMenu } from './localize';

export const menuKeys = {
  menu: ['menu'] as const,
  item: (id: string) => ['menu', 'item', id] as const,
};

/**
 * The public menu, in the active language (ADR-037). The cache holds the
 * server's shape; switching language re-selects it without a refetch.
 * Socket `menu:changed` invalidates this key from M8 on.
 */
export function useMenu() {
  const lang = useLang();
  const select = useCallback((menu: MenuDto) => localizeMenu(menu, lang), [lang]);
  return useQuery({
    queryKey: menuKeys.menu,
    queryFn: () => api<MenuDto>('/menu', { anonymous: true }),
    select,
  });
}

export function useMenuItem(id: string | null) {
  const lang = useLang();
  const select = useCallback((item: MenuItemDto) => localizeItem(item, lang), [lang]);
  return useQuery({
    queryKey: menuKeys.item(id ?? 'none'),
    queryFn: () => api<MenuItemDto>(`/menu/items/${id ?? ''}`, { anonymous: true }),
    enabled: id !== null,
    select,
  });
}
