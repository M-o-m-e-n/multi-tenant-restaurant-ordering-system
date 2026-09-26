import type { OrderDto } from '@ros/shared';
import { type FormEvent, useState } from 'react';

import { useT } from '../../i18n';
import { errorMessage } from '../../shared/api/errorMessage';
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
  const t = useT();

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!order) return;
    const form = new FormData(e.currentTarget);
    const amount = parseMoneyInput(formValue(form, 'amount'));
    const tipText = formValue(form, 'tip').trim();
    const tip = tipText ? parseMoneyInput(tipText) : 0;
    if (amount === null || amount <= 0) return setError(t.cashDialog.badAmount);
    if (tip === null) return setError(t.cashDialog.badTip);
    if (amount > order.balanceDue)
      return setError(t.cashDialog.tooMuch(formatMoney(order.balanceDue)));
    setError(null);
    try {
      await record.mutateAsync({ orderId: order.id, amount, tipAmount: tip });
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Modal
      open={order !== null}
      onClose={onClose}
      title={t.cashDialog.title(order?.orderNumber ?? '')}
    >
      {order && (
        <form className="flex flex-col gap-4" onSubmit={(e) => void submit(e)}>
          <p className="text-sm text-ink-muted">
            {t.cashDialog.owed}{' '}
            <strong className="tabular text-ink">{formatMoney(order.balanceDue)}</strong>
            {t.cashDialog.splitHint}
          </p>
          <Field
            label={t.cashDialog.amount}
            name="amount"
            inputMode="decimal"
            defaultValue={(order.balanceDue / 100).toFixed(2)}
            required
          />
          <Field label={t.cashDialog.tip} name="tip" inputMode="decimal" placeholder="0.00" />
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
            {record.isPending ? t.cashDialog.recording : t.cashDialog.record}
          </button>
        </form>
      )}
    </Modal>
  );
}
