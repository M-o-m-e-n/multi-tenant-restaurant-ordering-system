import type { ButtonHTMLAttributes } from 'react';

import { buttonClass, type ButtonSize, type ButtonVariant } from './buttonClass';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

/** The one button primitive; every surface extends it with a variant (CODING-STANDARDS §15). */
export function Button({ variant = 'primary', size = 'md', className = '', ...rest }: ButtonProps) {
  return (
    <button type="button" className={`${buttonClass(variant, size)} ${className}`} {...rest} />
  );
}
