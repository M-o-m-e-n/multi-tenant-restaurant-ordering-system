import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { buildOpenApi } from '../src/openapi/document';

// Writes docs/openapi.json from the shared Zod schemas (M13-S8, NFR-M5).
const out = resolve(import.meta.dirname, '../../docs/openapi.json');
writeFileSync(out, `${JSON.stringify(buildOpenApi('1.0.0'), null, 2)}\n`);
process.stdout.write(`wrote ${out}\n`);
