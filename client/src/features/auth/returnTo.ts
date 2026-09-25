/** Only same-site paths may be returned to after sign-in, never an absolute URL. */
export function safeReturnTo(value: string | null): string | null {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : null;
}
