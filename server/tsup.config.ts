import { defineConfig } from 'tsup';

// @ros/shared ships TypeScript source, so it is bundled into the server
// output; every other dependency stays external and resolves at runtime.
export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  noExternal: ['@ros/shared'],
});
