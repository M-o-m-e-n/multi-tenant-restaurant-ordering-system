import { afterEach, describe, expect, it, vi } from 'vitest';

import { flyToCart, prefersReducedMotion } from './motionUtils';

type Rect = { left: number; top: number; width: number; height: number };

interface FakeEl {
  style: Record<string, string>;
  src: string;
  alt: string;
  textContent: string | null;
  getBoundingClientRect: () => Rect;
  setAttribute: (...args: unknown[]) => void;
  appendChild: (...args: unknown[]) => void;
  remove: () => void;
  animate?: (...args: unknown[]) => FakeFlight;
}

interface FakeFlight {
  onfinish: (() => void) | null;
}

const rect = (left: number, top: number): Rect => ({ left, top, width: 10, height: 10 });

function makeEl(over: Partial<FakeEl> = {}): FakeEl {
  return {
    style: {},
    src: '',
    alt: '',
    textContent: null,
    getBoundingClientRect: () => rect(0, 0),
    setAttribute: () => undefined,
    appendChild: () => undefined,
    remove: () => undefined,
    ...over,
  };
}

function matchMedia(matches: boolean): void {
  vi.stubGlobal('matchMedia', () => ({ matches }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('prefersReducedMotion', () => {
  it('mirrors the media query', () => {
    matchMedia(true);
    expect(prefersReducedMotion()).toBe(true);
    matchMedia(false);
    expect(prefersReducedMotion()).toBe(false);
  });

  it('assumes no preference when matchMedia is missing', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(prefersReducedMotion()).toBe(false);
  });
});

describe('flyToCart', () => {
  function fakeDocument(target: FakeEl | null) {
    const created: FakeEl[] = [];
    const appended: FakeEl[] = [];
    return {
      created,
      appended,
      doc: {
        querySelector: (_sel: string): FakeEl | null => target,
        createElement: (_tag: string): FakeEl => {
          const el = makeEl();
          created.push(el);
          return el;
        },
        body: {
          appendChild: (el: FakeEl): void => {
            appended.push(el);
          },
        },
      },
    };
  }

  const fromRect = () => rect(10, 20);

  it('skips the flight when reduced motion is preferred', () => {
    matchMedia(true);
    const { created, doc } = fakeDocument(makeEl());
    vi.stubGlobal('document', doc);
    const from = { ...makeEl(), animate: vi.fn() } as unknown as HTMLElement;
    flyToCart(from, null, 'Soup');
    expect(created).toHaveLength(0);
  });

  it('skips the flight when there is no cart target', () => {
    matchMedia(false);
    const { created, doc } = fakeDocument(null);
    vi.stubGlobal('document', doc);
    const from = { ...makeEl(), animate: vi.fn() } as unknown as HTMLElement;
    flyToCart(from, null, 'Soup');
    expect(created).toHaveLength(0);
  });

  it('skips the flight when the element cannot animate', () => {
    matchMedia(false);
    const target = makeEl({ getBoundingClientRect: () => rect(100, 50) });
    const { created, doc } = fakeDocument(target);
    vi.stubGlobal('document', doc);
    const from = makeEl() as unknown as HTMLElement;
    flyToCart(from, null, 'Soup');
    expect(created).toHaveLength(0);
  });

  it('flies a dot to the cart and removes it when the flight ends', () => {
    matchMedia(false);
    const removed: string[] = [];
    const flight: FakeFlight = { onfinish: null };
    const dotAnimate = vi.fn((..._args: unknown[]): FakeFlight => flight);
    const target = makeEl({ getBoundingClientRect: () => rect(100, 50) });
    const { created, appended, doc } = fakeDocument(target);
    vi.stubGlobal('document', {
      ...doc,
      createElement: (_tag: string): FakeEl => {
        const el = makeEl({ remove: () => removed.push(_tag), animate: dotAnimate });
        created.push(el);
        return el;
      },
    });
    const animate = vi.fn((..._args: unknown[]): FakeFlight => flight);
    const from = {
      ...makeEl(),
      getBoundingClientRect: fromRect,
      animate,
    } as unknown as HTMLElement;

    flyToCart(from, 'https://img/x.jpg', 'Soup');

    expect(created).toHaveLength(2);
    expect(created.some((el) => el.src === 'https://img/x.jpg')).toBe(true);
    expect(appended).toHaveLength(1);
    expect(dotAnimate).toHaveBeenCalledTimes(1);
    flight.onfinish?.();
    expect(removed).toEqual(['div']);
  });

  it('falls back to an initial when the dish has no image', () => {
    matchMedia(false);
    const flight: FakeFlight = { onfinish: null };
    const target = makeEl({ getBoundingClientRect: () => rect(100, 50) });
    const { created, doc } = fakeDocument(target);
    vi.stubGlobal('document', {
      ...doc,
      createElement: (_tag: string): FakeEl => {
        const el = makeEl({ animate: (..._args: unknown[]): FakeFlight => flight });
        created.push(el);
        return el;
      },
    });
    const from = {
      ...makeEl(),
      getBoundingClientRect: fromRect,
      animate: (..._args: unknown[]): FakeFlight => flight,
    } as unknown as HTMLElement;

    flyToCart(from, null, 'Soup');

    expect(created).toHaveLength(1);
    expect(created[0]?.textContent).toBe('S');
  });
});
