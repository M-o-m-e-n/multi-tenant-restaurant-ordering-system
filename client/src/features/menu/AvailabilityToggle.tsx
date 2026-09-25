interface Props {
  name: string;
  isAvailable: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}

/**
 * The 86 switch. State is carried by text as well as colour ("On menu" /
 * "86'd") so it reads without colour vision (NFR-U3). One tap flips it.
 */
export function AvailabilityToggle({ name, isAvailable, disabled, onChange }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isAvailable}
      aria-label={`${name} available`}
      disabled={disabled}
      onClick={() => onChange(!isAvailable)}
      className={`inline-flex min-h-11 min-w-28 items-center justify-center gap-2 rounded-btn border px-3 text-xs font-semibold transition ${
        isAvailable ? 'border-ok/60 text-ok' : 'border-flame bg-flame text-white'
      }`}
    >
      <span aria-hidden="true">{isAvailable ? '●' : '⊘'}</span>
      {isAvailable ? 'On menu' : '86’d'}
    </button>
  );
}
