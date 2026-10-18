export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-flame text-white shadow-glow hover:brightness-110',
  secondary: 'border border-line bg-paper text-paper-ink hover:brightness-95',
  ghost: 'border border-line-strong bg-surface-raised text-ink hover:border-ink-muted',
  danger: 'border border-flame-text text-flame-text hover:bg-flame hover:text-white',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-4 text-sm',
  md: 'min-h-11 px-6 text-sm',
  lg: 'min-h-12 px-8 text-base',
};

/** Class string for anything that should look like a button, links included. */
export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md'): string {
  return `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-btn font-semibold transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]}`;
}
