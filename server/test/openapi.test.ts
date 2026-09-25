import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { buildOpenApi, ENDPOINTS } from '../src/openapi/document';
import { listRoutes } from '../src/openapi/routes';

describe('OpenAPI document (M13-S8)', () => {
  it('describes exactly the routes the server mounts', () => {
    const served = listRoutes(createApp({ rateLimits: false }));
    const documented = ENDPOINTS.map((e) => `${e.method.toUpperCase()} ${e.path}`).sort();
    expect(documented).toEqual(served);
  });

  it('carries each validated body as JSON Schema with unknown fields refused', () => {
    const doc = buildOpenApi('test') as {
      paths: Record<
        string,
        Record<
          string,
          {
            requestBody?: {
              content: Record<string, { schema: { additionalProperties?: boolean } }>;
            };
          }
        >
      >;
    };
    const create =
      doc.paths['/api/v1/orders']?.post?.requestBody?.content['application/json']?.schema;
    expect(create).toBeDefined();
    expect(create?.additionalProperties).toBe(false);
  });

  it('matches the committed docs/openapi.json (run `npm run openapi -w server`)', () => {
    const committed = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../../docs/openapi.json'), 'utf8'),
    ) as unknown;
    expect(committed).toEqual(buildOpenApi('1.0.0'));
  });
});
