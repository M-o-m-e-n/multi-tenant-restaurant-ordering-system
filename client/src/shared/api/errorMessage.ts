import { tNow, useLangStore } from '../../i18n';
import { ApiError } from './client';

/**
 * What to tell a person when a request fails (M14-S4). Server messages are
 * English (they are also for logs), so in English the server's own, specific
 * message wins; in any other language the error's code picks a translated
 * line, and an unknown code falls back to `fallback` rather than showing
 * English to someone who can't read it.
 */
export function errorMessage(err: unknown, fallback?: string): string {
  const t = tNow();
  if (err instanceof ApiError) {
    const known = (t.errors as Readonly<Record<string, string>>)[err.code];
    if (useLangStore.getState().lang === 'en') {
      return err.message || known || fallback || t.errors.generic;
    }
    return known ?? fallback ?? t.errors.generic;
  }
  return fallback ?? t.errors.network;
}
