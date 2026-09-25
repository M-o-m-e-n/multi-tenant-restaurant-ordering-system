import {
  canAssignDriver,
  DELIVERY_STATUSES,
  type DeliveryStatus,
  NEXT_DELIVERY_STATUS,
  type OrderDto,
} from '@ros/shared';
import { type FormEvent, useState } from 'react';

import { ApiError } from '../../shared/api/client';
import { buttonClass } from '../../shared/ui/buttonClass';
import { formValue } from '../../shared/ui/formValue';
import { useUpdateDelivery } from './deliveryApi';
import { DELIVERY_LABEL } from './labels';

const ADVANCE: Partial<Record<DeliveryStatus, string>> = {
  PICKED_UP: 'Mark picked up',
  DELIVERED: 'Mark delivered',
};

type Delivery = NonNullable<OrderDto['delivery']>;

/** Staff view of a delivery: address, driver assignment and the next step (DEL-03/04). */
export function DeliveryPanel({ orderId, delivery }: { orderId: string; delivery: Delivery }) {
  const update = useUpdateDelivery();
  const [message, setMessage] = useState<string | null>(null);
  const next = NEXT_DELIVERY_STATUS[delivery.status];
  const onError = (err: unknown) =>
    setMessage(err instanceof ApiError ? err.message : 'That did not work.');

  function assign(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const driverName = formValue(new FormData(e.currentTarget), 'driver').trim();
    if (!driverName) return;
    setMessage(null);
    update.mutate({ orderId, body: { driverName } }, { onError });
  }

  return (
    <div className="flex flex-col gap-3 rounded-icon border border-line-strong p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">Delivery · {DELIVERY_LABEL[delivery.status]}</p>
        {delivery.driverName && <p className="text-ink-muted">Driver: {delivery.driverName}</p>}
      </div>
      <p>
        {delivery.address}
        {delivery.note && <span className="block text-xs text-ink-muted">{delivery.note}</span>}
      </p>
      {canAssignDriver(delivery.status) && (
        <form className="flex flex-wrap gap-2" onSubmit={assign}>
          <label className="flex-1">
            <span className="sr-only">Driver name</span>
            <input
              name="driver"
              required
              maxLength={80}
              defaultValue={delivery.driverName ?? ''}
              placeholder="Driver name"
              className="min-h-11 w-full rounded-btn border border-line-strong bg-bg px-4"
            />
          </label>
          <button type="submit" className={buttonClass('ghost')} disabled={update.isPending}>
            {delivery.driverName ? 'Reassign' : 'Assign driver'}
          </button>
        </form>
      )}
      {next && ADVANCE[next] && (
        <button
          type="button"
          className={buttonClass('primary')}
          disabled={update.isPending}
          onClick={() => {
            setMessage(null);
            update.mutate({ orderId, body: { status: next } }, { onError });
          }}
        >
          {ADVANCE[next]}
        </button>
      )}
      {message && (
        <p role="alert" className="text-flame-text">
          {message}
        </p>
      )}
    </div>
  );
}

/** Guest view: the four delivery steps, each labelled in text (NFR-U3). */
export function DeliveryProgress({ delivery }: { delivery: Delivery }) {
  const current = DELIVERY_STATUSES.indexOf(delivery.status);
  return (
    <section aria-label="Delivery progress" className="mt-6 rounded-card border border-line p-4">
      <p className="text-sm font-semibold">
        {DELIVERY_LABEL[delivery.status]}
        {delivery.driverName && delivery.status !== 'PENDING' && (
          <span className="font-normal text-ink-muted"> · {delivery.driverName}</span>
        )}
      </p>
      <ol className="mt-3 grid grid-cols-4 gap-2">
        {DELIVERY_STATUSES.map((s, i) => (
          <li key={s} aria-current={i === current ? 'step' : undefined}>
            <span
              className={`block h-1.5 rounded-btn ${i <= current ? 'bg-flame' : 'bg-line'}`}
              aria-hidden="true"
            />
            <span
              className={`mt-1.5 block text-xs ${i === current ? 'font-semibold text-ink' : 'text-ink-muted'}`}
            >
              {DELIVERY_LABEL[s]}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-ink-muted">To {delivery.address}</p>
    </section>
  );
}
