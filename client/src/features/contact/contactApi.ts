import type {
  ContactKind,
  ContactMessageDto,
  CreateContactMessageDto,
  Paginated,
} from '@ros/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../../shared/api/client';

export const messageKeys = {
  all: ['messages'] as const,
  list: (f: MessageFilter) => ['messages', f] as const,
  unread: ['messages', 'unread'] as const,
};

export interface MessageFilter {
  unread: boolean;
  kind: ContactKind | null;
  limit: number;
}

type Inbox = Paginated<ContactMessageDto> & { unread: number };

/** POST /contact: the public feedback form. */
export function useSendMessage() {
  return useMutation({
    mutationFn: (body: CreateContactMessageDto) =>
      api<{ id: string }>('/contact', { method: 'POST', body }),
  });
}

/** The admin inbox; `message:new` invalidates it, with a slow poll as a net. */
export function useMessages(f: MessageFilter) {
  const q = new URLSearchParams({ limit: String(f.limit) });
  if (f.unread) q.set('unread', 'true');
  if (f.kind) q.set('kind', f.kind);
  return useQuery({
    queryKey: messageKeys.list(f),
    queryFn: () => api<Inbox>(`/staff/messages?${q.toString()}`),
    refetchInterval: 120_000,
  });
}

/** Just the unread count, for the admin nav badge. */
export function useUnreadCount(enabled: boolean) {
  return useQuery({
    queryKey: messageKeys.unread,
    queryFn: () => api<Inbox>('/staff/messages?unread=true&limit=1').then((r) => r.unread),
    enabled,
    refetchInterval: 120_000,
  });
}

export function useMarkMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, read }: { id: string; read: boolean }) =>
      api<ContactMessageDto>(`/staff/messages/${id}`, { method: 'PATCH', body: { read } }),
    onSettled: () => qc.invalidateQueries({ queryKey: messageKeys.all }),
  });
}
