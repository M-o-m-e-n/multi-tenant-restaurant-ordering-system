import { type ComponentType, lazy, type LazyExoticComponent, Suspense } from 'react';

import { useT } from '../../i18n';

/**
 * A route page loaded on first visit. Pages use named exports, so the loader
 * picks the export by name; the fallback matches the other loading states.
 */
export function lazyPage<K extends string>(
  load: () => Promise<Record<K, ComponentType>>,
  name: K,
): ComponentType {
  return lazyComponent(() => load().then((m) => m[name]));
}

/** A component loaded on first render, such as a tenant's page (brand/types.ts `PageLoader`). */
export function lazyComponent(load: () => Promise<ComponentType>): ComponentType {
  const Page: LazyExoticComponent<ComponentType> = lazy(() =>
    load().then((component) => ({ default: component })),
  );
  return function LazyRoute() {
    const t = useT();
    return (
      <Suspense
        fallback={
          <p role="status" className="p-10 text-center text-ink-muted">
            {t.common.loading}
          </p>
        }
      >
        <Page />
      </Suspense>
    );
  };
}
