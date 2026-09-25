import { describe, expect, it } from 'vitest';

import { ar } from './ar';
import { en } from './en';
import { plural } from './plural';

/** Every key path in a dictionary, e.g. "nav.cart". */
function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v as object, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe('i18n dictionaries', () => {
  it('Arabic has exactly the English key set (typecheck also enforces this)', () => {
    expect(keys(ar).sort()).toEqual(keys(en).sort());
  });

  it('no Arabic string is left empty or copied verbatim from English', () => {
    const flat = (o: object, p = ''): [string, unknown][] =>
      Object.entries(o).flatMap(([k, v]) =>
        v && typeof v === 'object' ? flat(v as object, `${p}${k}.`) : [[`${p}${k}`, v]],
      );
    const english = new Map(flat(en));
    for (const [key, value] of flat(ar)) {
      if (typeof value !== 'string') continue;
      expect(value.trim(), key).not.toBe('');
      // Brand-neutral tokens may coincide; anything longer than a word must be translated.
      if (value.length > 3) expect(value, key).not.toBe(english.get(key));
    }
  });

  it('uses Arabic plural categories', () => {
    const forms = {
      zero: 'لا أصناف',
      one: 'صنف واحد',
      two: 'صنفان',
      few: '{n} أصناف',
      many: '{n} صنفًا',
      other: '{n} صنف',
    };
    expect(plural('ar', 0, forms)).toBe('لا أصناف');
    expect(plural('ar', 1, forms)).toBe('صنف واحد');
    expect(plural('ar', 2, forms)).toBe('صنفان');
    expect(plural('ar', 5, forms)).toBe('5 أصناف');
    expect(plural('ar', 11, forms)).toBe('11 صنفًا');
    expect(plural('ar', 100, forms)).toBe('100 صنف');
    expect(plural('en', 1, { one: '1 item', other: '{n} items' })).toBe('1 item');
    expect(plural('en', 3, { one: '1 item', other: '{n} items' })).toBe('3 items');
  });
});
