import type { Express } from 'express';

interface Layer {
  route?: { path: string; methods: Record<string, boolean> };
  name: string;
  regexp: RegExp & { fast_slash?: boolean };
  handle: { stack?: Layer[] };
}

/** The mount path an Express 4 router layer was registered under, e.g. `/orders`. */
function mountPath(layer: Layer): string {
  if (layer.regexp.fast_slash) return '';
  // Express 4 compiles app.use('/orders', r) to /^\/orders\/?(?=\/|$)/i.
  return layer.regexp.source.replace(/^\^/, '').replace('\\/?(?=\\/|$)', '').replace(/\\\//g, '/');
}

/**
 * Every `METHOD /path` the app actually serves, with Express `:param`s
 * rewritten as OpenAPI `{param}`. Used to prove the OpenAPI document is
 * complete (M13-S8).
 */
export function listRoutes(app: Express): string[] {
  const out = new Set<string>();
  const walk = (stack: Layer[], prefix: string) => {
    for (const layer of stack) {
      if (layer.route) {
        const own = layer.route.path === '/' && prefix ? '' : layer.route.path;
        for (const method of Object.keys(layer.route.methods)) {
          out.add(`${method.toUpperCase()} ${`${prefix}${own}`.replace(/:(\w+)/g, '{$1}')}`);
        }
      } else if (layer.name === 'router' && layer.handle.stack) {
        walk(layer.handle.stack, prefix + mountPath(layer));
      }
    }
  };
  walk((app as unknown as { _router: { stack: Layer[] } })._router.stack, '');
  return [...out].sort();
}
