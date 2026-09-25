/**
 * The one HTTP client. It holds the access token in module memory only —
 * never localStorage or sessionStorage (AUTH-12, AC-22) — and on a 401 it
 * refreshes once and replays the request once (CODING-STANDARDS §12).
 */

export const API_BASE = '/api/v1';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, unknown>;
    requestId?: string;
  };
}

let accessToken: string | null = null;
let onSessionEnded: ((code: string) => void) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/** Called when a refresh fails: the auth store clears itself and routes to login. */
export function onSessionEnd(handler: (code: string) => void): void {
  onSessionEnded = handler;
}

async function toApiError(res: Response): Promise<ApiError> {
  let body: ErrorBody = {};
  try {
    body = (await res.json()) as ErrorBody;
  } catch {
    // Not JSON (a proxy error page, say); fall back to the status line.
  }
  return new ApiError(
    res.status,
    body.error?.code ?? `HTTP_${res.status}`,
    body.error?.message ?? res.statusText,
    body.error?.details,
    body.error?.requestId,
  );
}

let refreshing: Promise<string> | null = null;

async function doRefresh(): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-Refresh-Request': '1' },
  });
  if (!res.ok) throw await toApiError(res);
  const body = (await res.json()) as { accessToken: string };
  setAccessToken(body.accessToken);
  return body.accessToken;
}

/**
 * Exactly one refresh in flight. Concurrent callers share it: parallel
 * refreshes would each rotate the token, and every rotation but the last would
 * look like a replay and revoke the session (AUTH-11, CODING-STANDARDS §12).
 */
export function refreshAccessToken(): Promise<string> {
  refreshing ??= doRefresh().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Send without the bearer token and skip the refresh-and-retry. */
  anonymous?: boolean;
}

async function send(path: string, opts: RequestOptions): Promise<Response> {
  const { body, anonymous, headers, ...rest } = opts;
  const h = new Headers(headers);
  if (body !== undefined) h.set('Content-Type', 'application/json');
  if (!anonymous && accessToken) h.set('Authorization', `Bearer ${accessToken}`);
  return fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: h,
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/**
 * Call the API and return the parsed JSON body (undefined for 204).
 * @throws ApiError carrying the server's error code
 */
export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  let res = await send(path, opts);

  if (res.status === 401 && !opts.anonymous) {
    const err = await toApiError(res);
    // Only an expired or missing access token is worth one refresh; a disabled
    // account or a bad refresh ends the session immediately.
    if (err.code !== 'UNAUTHENTICATED') {
      endSession(err.code);
      throw err;
    }
    try {
      await refreshAccessToken();
    } catch (refreshErr) {
      endSession(refreshErr instanceof ApiError ? refreshErr.code : 'REFRESH_TOKEN_INVALID');
      throw err;
    }
    res = await send(path, opts);
    if (res.status === 401) {
      const again = await toApiError(res);
      endSession(again.code);
      throw again;
    }
  }

  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function endSession(code: string): void {
  setAccessToken(null);
  onSessionEnded?.(code);
}
