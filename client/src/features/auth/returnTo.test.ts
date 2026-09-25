import { describe, expect, it } from 'vitest';

import { safeReturnTo } from './returnTo';

describe('safeReturnTo', () => {
  it('keeps same-site paths with their query', () => {
    expect(safeReturnTo('/orders/abc?tab=1')).toBe('/orders/abc?tab=1');
    // An encoded newline is just text in a path; it is never decoded into a redirect.
    expect(safeReturnTo('/menu%0a')).toBe('/menu%0a');
  });

  it('refuses absolute, protocol-relative and backslash tricks', () => {
    for (const bad of [
      null,
      '',
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      '/\\/evil.example',
      '/\tevil.example',
      '/ /evil.example',
      'javascript:alert(1)',
    ]) {
      expect(safeReturnTo(bad), String(bad)).toBeNull();
    }
  });
});
