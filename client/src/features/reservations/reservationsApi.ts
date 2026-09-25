import type { CreateReservationDto, ReservationDto, UpdateReservationDto } from '@ros/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../../shared/api/client';

export const reservationKeys = {
  all: ['reservations'] as const,
  day: (date: string) => ['reservations', date] as const,
};

/** One business date's bookings; `reservation:flag` invalidates it, with a poll as a net. */
export function useReservations(date: string) {
  return useQuery({
    queryKey: reservationKeys.day(date),
    queryFn: () =>
      api<{ data: ReservationDto[] }>(`/reservations?date=${date}`).then((r) => r.data),
    refetchInterval: 60_000,
  });
}

export function useCreateReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateReservationDto) =>
      api<ReservationDto>('/reservations', { method: 'POST', body }),
    onSettled: () => qc.invalidateQueries({ queryKey: reservationKeys.all }),
  });
}

export function useUpdateReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateReservationDto }) =>
      api<ReservationDto>(`/reservations/${id}`, { method: 'PATCH', body }),
    onSettled: async () => {
      await qc.invalidateQueries({ queryKey: reservationKeys.all });
      await qc.invalidateQueries({ queryKey: ['tables'] });
    },
  });
}
