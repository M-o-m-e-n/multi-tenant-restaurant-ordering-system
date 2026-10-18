import { describe, expect, it } from 'vitest';

import {
  directionsUrl,
  distanceKm,
  embedUrl,
  localPhone,
  nearest,
  parseMapsLink,
  whatsappUrl,
} from './maps';

const RIVERSIDE = { lat: 30.0707126, lng: 31.2061639 };
const CENTRE = { lat: 30.0545106, lng: 31.2097923 };

describe('map links', () => {
  it('builds the keyless embed and directions links', () => {
    expect(embedUrl(RIVERSIDE, 'ar')).toBe(
      'https://maps.google.com/maps?q=30.070713,31.206164&z=17&hl=ar&output=embed',
    );
    expect(directionsUrl(RIVERSIDE)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=30.070713,31.206164',
    );
  });

  it('formats Egyptian numbers for WhatsApp and for reading', () => {
    expect(whatsappUrl('+201001234567')).toBe('https://wa.me/201001234567');
    expect(localPhone('+201001234567')).toBe('010 0123 4567');
    expect(localPhone('+15550101')).toBe('+15550101');
  });
});

describe('parseMapsLink', () => {
  it('prefers the pin in a place link over the map view', () => {
    const link =
      'https://www.google.com/maps/place/Our+Place/@30.0700000,31.2000000,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d30.0691234!4d31.2045678';
    expect(parseMapsLink(link)).toEqual({ lat: 30.0691234, lng: 31.2045678 });
  });

  it('reads ?q= and ?query= links, the map view, and bare pairs', () => {
    expect(parseMapsLink('https://maps.google.com/?q=30.07,31.206')).toEqual({
      lat: 30.07,
      lng: 31.206,
    });
    expect(
      parseMapsLink('https://www.google.com/maps/search/?api=1&query=30.0545%2C31.2098'),
    ).toEqual({ lat: 30.0545, lng: 31.2098 });
    expect(parseMapsLink('https://www.google.com/maps/@30.0545,31.2098,15z')).toEqual({
      lat: 30.0545,
      lng: 31.2098,
    });
    expect(parseMapsLink(' 30.0545, 31.2098 ')).toEqual({ lat: 30.0545, lng: 31.2098 });
  });

  it('returns null for short links, text and impossible coordinates', () => {
    expect(parseMapsLink('https://maps.app.goo.gl/abc123')).toBeNull();
    expect(parseMapsLink('شارع النيل')).toBeNull();
    expect(parseMapsLink('https://maps.google.com/?q=95,31')).toBeNull();
  });
});

describe('nearest branch', () => {
  it('measures distance in kilometres', () => {
    expect(distanceKm(RIVERSIDE, CENTRE)).toBeGreaterThan(1.7);
    expect(distanceKm(RIVERSIDE, CENTRE)).toBeLessThan(1.9);
    expect(distanceKm(RIVERSIDE, RIVERSIDE)).toBe(0);
  });

  it('picks the closest branch that has a pin and skips the others', () => {
    const branches = [
      { slug: 'old-town', position: CENTRE },
      { slug: 'nowhere', position: null },
      { slug: 'riverside', position: RIVERSIDE },
    ];
    const near = nearest({ lat: 30.069, lng: 31.205 }, branches);
    expect(near?.place.slug).toBe('riverside');
    expect(near?.km).toBeLessThan(0.3);
    expect(nearest(RIVERSIDE, [{ position: null }])).toBeNull();
  });
});
