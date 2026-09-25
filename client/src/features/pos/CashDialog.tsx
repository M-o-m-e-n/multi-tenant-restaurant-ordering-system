import type { OrderDto } from '@ros/shared';
import { type FormEvent, useState } from 'react';

import { ApiError } from '../../shared/api/client';
import { formatMoney, parseMoneyInput } from '../../shared/money';
import { buttonClass } from '../../shared/ui/buttonClass';
import { Field } from '../../shared/ui/Field';
import { formValue } from '../../shared/ui/formValue';
import { Modal } from '../../shared/ui/Modal';
import { useRecordCash } from '../payments/paymentsApi';

/**
 * Take cash (PAY-05). The amount defaults to the balance; entering less makes
 * it a split payment (PAY-06). A cash tip is recorded alongside (TIP-02) and
 * never counts toward the bill.
 */
export function CashDialog({ order, onClose }: { order: OrderDto | null; onClose: () => void }) {
  const record = useRecordCash();
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!order) return;
    const form = new FormData(e.currentTarget);
    const amount = parseMoneyInput(formValue(form, 'amount'));
    const tipText = formValue(form, 'tip').trim();
    const tip = tipText ? parseMoneyInput(tipText) : 0;
    if (amount === null || amount <= 0) return setError('Enter the amount received, e.g. 24.50.');
    if (tip === null) return setError('Enter the tip as an amount, e.g. 3.');
    if (amount > order.balanceDue)
      return setError(`That is more than the ${formatMoney(order.balanceDue)} still owed.`);
    setError(null);
    try {
      await record.mutateAsync({ orderId: order.id, amount, tipAmount: tip });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The payment was not recorded. Try again.');
    }
  }

  return (
    <Modal open={order !== null} onClose={onClose} title={`Cash · ${order?.orderNumber ?? ''}`}>
      {order && (
        <form className="flex flex-col gap-4" onSubmit={(e) => void submit(e)}>
          <p className="text-sm text-ink-muted">
            Still owed <strong className="tabular text-ink">{formatMoney(order.balanceDue)}</strong>
            . Enter less to split the bill.
          </p>
          <Field
            label="Amount ($)"
            name="amount"
            inputMode="decimal"
            defaultValue={(order.balanceDue / 100).toFixed(2)}
            required
          />
          <Field label="Cash tip ($, optional)" name="tip" inputMode="decimal" placeholder="0.00" />
          {error && (
            <p role="alert" className="text-sm text-flame-text">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={record.isPending}
            className={buttonClass('primary', 'lg')}
          >
            {record.isPending ? 'Recording…' : 'Record cash payment'}
          </button>
        </form>
      )}
    </Modal>
  );
}
