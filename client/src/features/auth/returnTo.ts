/**
 * Only same-site paths may be returned to after sign-in, never an absolute URL.
 * Browsers read `/\host` and `/<tab>/host` as `//host`, so a backslash or any
 * whitespace/control character anywhere refuses the value (react-router
 * CVE-2025-68470 class of open redirect).
 */
export function safeReturnTo(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\\\s\u0000-\u001f\u007f]/.test(value)) return null;
  return value;
}
