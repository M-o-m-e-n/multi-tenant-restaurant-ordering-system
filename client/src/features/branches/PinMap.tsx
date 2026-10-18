import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import { useEffect, useRef } from 'react';

import { brand } from '../../brand';
import type { LatLng } from './maps';

/** Where the map opens for a branch that has no pin yet. */
const FALLBACK: LatLng = brand.mapCentre;

/** A flame-red pin drawn in CSS, so no marker images have to be bundled. */
const pin = L.divIcon({
  className: '',
  html: '<span class="pin-marker" aria-hidden="true"></span>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

/**
 * The admin's map for placing a branch pin (ADR-032): Leaflet over free
 * OpenStreetMap tiles, loaded only on this admin screen. Drag the pin, or
 * click anywhere to drop it there; the arrow keys move it too.
 */
export function PinMap({
  value,
  onChange,
  label,
}: {
  value: LatLng | null;
  onChange: (p: LatLng) => void;
  label: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const change = useRef(onChange);
  change.current = onChange;

  useEffect(() => {
    if (!host.current) return;
    const start = value ?? FALLBACK;
    const m = L.map(host.current, { scrollWheelZoom: false }).setView(
      [start.lat, start.lng],
      value ? 17 : 14,
    );
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(m);
    const mk = L.marker([start.lat, start.lng], {
      draggable: true,
      icon: pin,
      keyboard: true,
      title: label,
    }).addTo(m);
    const emit = (ll: L.LatLng) =>
      change.current({ lat: Number(ll.lat.toFixed(6)), lng: Number(ll.lng.toFixed(6)) });
    mk.on('dragend', () => emit(mk.getLatLng()));
    m.on('click', (e: L.LeafletMouseEvent) => {
      mk.setLatLng(e.latlng);
      emit(e.latlng);
    });
    map.current = m;
    marker.current = mk;
    return () => {
      m.remove();
      map.current = null;
      marker.current = null;
    };
    // The map is built once; later value changes move the marker below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A pasted link moves the pin and recentres the map.
  useEffect(() => {
    if (!value || !marker.current || !map.current) return;
    const at = marker.current.getLatLng();
    if (at.lat === value.lat && at.lng === value.lng) return;
    marker.current.setLatLng([value.lat, value.lng]);
    map.current.setView([value.lat, value.lng], Math.max(map.current.getZoom(), 16));
  }, [value]);

  return (
    <div
      ref={host}
      role="application"
      aria-label={label}
      className="relative z-0 h-72 w-full overflow-hidden rounded-card border border-line"
    />
  );
}
