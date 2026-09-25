import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api, getAccessToken, onSessionEnd, setAccessToken } from './client';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const unauthenticated = () => json(401, { error: { code: 'UNAUTHENTICATED', message: 'expired' } });

describe('api client', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    setAccessToken('old-token');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setAccessToken(null);
  });

  it('ten concurrent 401s produce exactly one refresh call, then all replay', async () => {
    let refreshCalls = 0;
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (url.endsWith('/auth/refresh')) {
        refreshCalls++;
        await new Promise((r) => setTimeout(r, 20));
        return json(200, { accessToken: 'new-token', expiresIn: 900 });
      }
      const auth = new Headers(init.headers).get('Authorization');
      return auth === 'Bearer new-token' ? json(200, { ok: true }) : unauthenticated();
    });

    const results = await Promise.all(Array.from({ length: 10 }, () => api('/orders')));
    expect(refreshCalls).toBe(1);
    expect(results).toHaveLength(10);
    expect(getAccessToken()).toBe('new-token');
  });

  it('retries once only and ends the session when the replay also fails', async () => {
    const ended = vi.fn();
    onSessionEnd(ended);
    let refreshCalls = 0;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/auth/refresh')) {
        refreshCalls++;
        return json(200, { accessToken: 'new-token', expiresIn: 900 });
      }
      return unauthenticated();
    });

    await expect(api('/orders')).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(refreshCalls).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(ended).toHaveBeenCalled();
  });

  it('does not refresh on ACCOUNT_DISABLED; it clears auth instead', async () => {
    const ended = vi.fn();
    onSessionEnd(ended);
    fetchMock.mockResolvedValue(json(401, { error: { code: 'ACCOUNT_DISABLED', message: 'x' } }));

    await expect(api('/auth/me')).rejects.toMatchObject({ code: 'ACCOUNT_DISABLED' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(ended).toHaveBeenCalledWith('ACCOUNT_DISABLED');
    expect(getAccessToken()).toBeNull();
  });

  it('sends credentials and the refresh CSRF header on refresh', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith('/auth/refresh')
        ? json(200, { accessToken: 't', expiresIn: 900 })
        : unauthenticated(),
    );
    await api('/x').catch(() => undefined);
    const [, init] = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/auth/refresh'))!;
    expect((init as RequestInit).credentials).toBe('include');
    expect(new Headers((init as RequestInit).headers).get('X-Refresh-Request')).toBe('1');
  });

  it('keeps the token out of browser storage', () => {
    setAccessToken('secret');
    expect(typeof localStorage === 'undefined' || localStorage.getItem('accessToken')).not.toBe(
      'secret',
    );
  });
});
