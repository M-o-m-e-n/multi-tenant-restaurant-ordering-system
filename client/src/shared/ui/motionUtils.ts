/**
 * True when the OS asks for reduced motion (CODING-STANDARDS §14, NFR-U3).
 * Every JS-driven animation bails out through here; CSS animations are
 * covered by the global rule in `styles/index.css`.
 */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Flies a dish thumbnail from the tapped button to the nav cart (which carries
 * `data-cart-target`). Purely decorative: the badge pop on the cart is the
 * state signal, so skipping the flight — reduced motion, missing target, no
 * Web Animations API — loses nothing.
 */
export function flyToCart(from: HTMLElement, imageUrl: string | null, name: string): void {
  if (prefersReducedMotion()) return;
  if (typeof document === 'undefined' || typeof from.animate !== 'function') return;
  const target = document.querySelector('[data-cart-target]');
  if (!target) return;
  const a = from.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const size = 46;
  const dot = document.createElement('div');
  dot.className = 'fly-dot';
  dot.setAttribute('aria-hidden', 'true');
  if (imageUrl) {
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = '';
    dot.appendChild(img);
  } else {
    dot.textContent = name.slice(0, 1);
  }
  dot.style.left = `${a.left + a.width / 2 - size / 2}px`;
  dot.style.top = `${a.top + a.height / 2 - size / 2}px`;
  if (typeof dot.animate !== 'function') return;
  document.body.appendChild(dot);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const flight = dot.animate(
    [
      { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
      {
        transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 72}px) scale(0.82)`,
        opacity: 1,
        offset: 0.55,
      },
      { transform: `translate(${dx}px, ${dy}px) scale(0.28)`, opacity: 0.7 },
    ],
    { duration: 620, easing: 'cubic-bezier(0.3,0.7,0.4,1)' },
  );
  flight.onfinish = () => dot.remove();
}
