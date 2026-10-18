/**
 * Free map helpers (ADR-032). Guests see Google Maps through its keyless
 * embed and deep links; nothing here needs an API key or sends the guest's
 * location anywhere.
 */
export interface LatLng {
  lat: number;
  lng: number;
}

const fixed = (p: LatLng) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;

/** The keyless Google Maps embed for an iframe, centred on the pin. */
export function embedUrl(p: LatLng, lang: 'en' | 'ar', zoom = 17): string {
  return `https://maps.google.com/maps?q=${fixed(p)}&z=${zoom}&hl=${lang}&output=embed`;
}

/** Opens turn-by-turn directions in the Google Maps app or site. */
export function directionsUrl(p: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${fixed(p)}`;
}

/** `+201001234567` → `https://wa.me/201001234567` */
export function whatsappUrl(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}`;
}

/** `+201001234567` → `010 0123 4567`, the way Egyptians write their numbers. */
export function localPhone(phone: string): string {
  const m = /^\+20(1\d)(\d{4})(\d{4})$/.exec(phone);
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : phone;
}

const inRange = (p: LatLng) => Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;

/**
 * Pull the coordinates out of a Google Maps link the owner pasted. It
 * understands the three shapes Google hands out: a place's `!3d…!4d…` data
 * (the pin itself, preferred), `?q=lat,lng` / `?query=` / `?destination=`,
 * and the `@lat,lng,zoom` of the map view. Short `maps.app.goo.gl` links
 * carry no coordinates until opened, so they return null.
 */
export function parseMapsLink(text: string): LatLng | null {
  const s = decodeURIComponent(text.trim());
  const num = '(-?\\d{1,3}(?:\\.\\d+)?)';
  const patterns = [
    new RegExp(`!3d${num}!4d${num}`),
    new RegExp(`[?&](?:q|query|destination|ll)=${num},\\s*${num}`),
    new RegExp(`@${num},${num}`),
    new RegExp(`^${num},\\s*${num}$`),
  ];
  for (const re of patterns) {
    const m = re.exec(s);
    if (m) {
      const p = { lat: Number(m[1]), lng: Number(m[2]) };
      if (inRange(p)) return p;
    }
  }
  return null;
}

/** Great-circle distance in kilometres (haversine). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** The closest of the places that have a position, with its distance; null if none do. */
export function nearest<T extends { position: LatLng | null }>(
  from: LatLng,
  places: readonly T[],
): { place: T; km: number } | null {
  let best: { place: T; km: number } | null = null;
  for (const place of places) {
    if (!place.position) continue;
    const km = distanceKm(from, place.position);
    if (!best || km < best.km) best = { place, km };
  }
  return best;
}
