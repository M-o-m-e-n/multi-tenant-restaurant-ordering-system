import { pino } from 'pino';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app';
import { LOG_REDACT, logger } from '../src/lib/logger';

const app = createApp({ rateLimits: false });

describe('hardening (M13-S1, S3)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends security headers suited to a JSON API', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['content-security-policy']).toBe(
      "default-src 'none';frame-ancestors 'none'",
    );
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toMatch(/max-age=31536000/);
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('caps JSON bodies at 256 KB with 413 PAYLOAD_TOO_LARGE', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'a@b.co', password: 'x'.repeat(300 * 1024) }));
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('logs each request once with the same request id the error body carries', async () => {
    const warn = vi.spyOn(logger(), 'warn');
    const res = await request(app).get('/api/v1/nope?token=secret-value');
    expect(res.status).toBe(404);
    const requestId = res.body.error.requestId as string;
    expect(res.headers['x-request-id']).toBe(requestId);
    expect(warn).toHaveBeenCalledTimes(1);
    const [entry] = warn.mock.calls[0] as [Record<string, unknown>];
    expect(entry).toMatchObject({ requestId, method: 'GET', path: '/api/v1/nope', status: 404 });
    expect(JSON.stringify(entry)).not.toContain('secret-value');
  });

  it('redacts authorization, passwords and tokens from log records', () => {
    const lines: string[] = [];
    const log = pino({ redact: LOG_REDACT }, { write: (line: string) => lines.push(line) });
    log.info({
      req: { headers: { authorization: 'Bearer abc', cookie: 'rt=xyz' } },
      body: { password: 'hunter2', token: 'tok', refreshToken: 'r' },
    });
    const out = lines.join('');
    for (const secret of ['Bearer abc', 'rt=xyz', 'hunter2', '"tok"', '"r"']) {
      expect(out).not.toContain(secret);
    }
    expect(out).toContain('[redacted]');
  });
});
