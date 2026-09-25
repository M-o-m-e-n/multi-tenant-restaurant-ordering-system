import { useState } from 'react';

import { formatMoney, parseMoneyInput } from '../../shared/money';
import type { TipChoice } from './cartStore';

interface Props {
  presetsBps: number[];
  value: TipChoice;
  /** What each preset works out to, for the labels. */
  presetAmount: (bps: number) => number;
  onChange: (tip: TipChoice) => void;
}

const chip = (on: boolean) =>
  `min-h-11 rounded-btn border px-4 text-sm font-semibold ${on ? 'border-flame bg-flame text-white' : 'border-line-strong bg-surface-raised'}`;

/** Tip presets, a custom amount, or none (TIP-01, TIP-05). Never taxed or discounted (BR-13). */
export function TipSelector({ presetsBps, value, presetAmount, onChange }: Props) {
  const [custom, setCustom] = useState(
    value.kind === 'custom' ? (value.cents / 100).toFixed(2) : '',
  );
  const [error, setError] = useState<string | null>(null);

  return (
    <fieldset>
      <legend className="text-xs font-medium uppercase tracking-wider text-ink-muted">
        Add a tip
      </legend>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={value.kind === 'none'}
          className={chip(value.kind === 'none')}
          onClick={() => onChange({ kind: 'none' })}
        >
          No tip
        </button>
        {presetsBps.map((bps) => {
          const on = value.kind === 'preset' && value.bps === bps;
          return (
            <button
              key={bps}
              type="button"
              aria-pressed={on}
              className={chip(on)}
              onClick={() => onChange({ kind: 'preset', bps })}
            >
              {bps / 100}%{' '}
              <span className={on ? '' : 'text-ink-muted'}>· {formatMoney(presetAmount(bps))}</span>
            </button>
          );
        })}
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const cents = parseMoneyInput(custom);
            if (cents === null) {
              setError('Enter an amount such as 5 or 5.50.');
              return;
            }
            setError(null);
            onChange({ kind: 'custom', cents });
          }}
        >
          <label className="sr-only" htmlFor="custom-tip">
            Custom tip in dollars
          </label>
          <input
            id="custom-tip"
            inputMode="decimal"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Custom $"
            className={`min-h-11 w-28 rounded-btn border bg-bg px-4 text-sm ${value.kind === 'custom' ? 'border-flame' : 'border-line-strong'}`}
          />
          <button type="submit" className="min-h-11 px-2 text-sm font-semibold text-flame-text">
            Set
          </button>
        </form>
      </div>
      {error && <p className="mt-1 text-xs text-flame-text">{error}</p>}
    </fieldset>
  );
}
