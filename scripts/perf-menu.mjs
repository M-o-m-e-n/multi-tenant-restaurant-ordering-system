// NFR-P1 / LLD §10.4 (M13-S6): 100 concurrent GET /api/v1/menu for 30 s against
// the production build; passes when p95 latency is under 300 ms and nothing fails.
//
//   npm run build && node scripts/perf-menu.mjs
//
// Starts the bundled API itself (rate limits off, logs quiet) unless PERF_URL
// points at a running server.
import { spawn } from 'node:child_process';

import autocannon from 'autocannon';

const external = process.env.PERF_URL;
const base = external ?? 'http://localhost:4000';
let server;

async function waitForHealth() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${base}/health`)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('API did not become healthy');
}

if (!external) {
  server = spawn(process.execPath, ['dist/server.js'], {
    cwd: new URL('../server/', import.meta.url),
    env: { ...process.env, RATE_LIMITS_DISABLED: 'true', LOG_LEVEL: 'warn' },
    stdio: 'inherit',
  });
}

try {
  await waitForHealth();
  const result = await autocannon({
    url: `${base}/api/v1/menu`,
    connections: 100,
    duration: 30,
  });
  const { latency, requests, non2xx, errors, timeouts } = result;
  // autocannon reports p90/p97.5/p99; interpolate p95 between p90 and p97.5.
  const p95Estimate = latency.p90 + ((latency.p97_5 - latency.p90) * (95 - 90)) / (97.5 - 90);
  const summary = {
    requests: requests.total,
    rps: Math.round(requests.average),
    p50: latency.p50,
    p90: latency.p90,
    p95: Math.round(p95Estimate),
    p97_5: latency.p97_5,
    p99: latency.p99,
    max: latency.max,
    non2xx,
    errors,
    timeouts,
  };
  console.log(JSON.stringify(summary, null, 2));
  const pass = p95Estimate < 300 && non2xx === 0 && errors === 0 && timeouts === 0;
  console.log(pass ? 'PASS: p95 < 300 ms' : 'FAIL');
  process.exitCode = pass ? 0 : 1;
} finally {
  server?.kill();
}
