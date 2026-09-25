/**
 * The single publish façade (HLD §8.2, CODING-STANDARDS §13). Services call
 * `publish` as their last step, after the transaction commits, so no client
 * ever sees an event for a rolled-back write. The Socket.IO transport attaches
 * itself at boot; with none attached, publishing is a no-op.
 */

/** Event names from LLD §6.2 — `order:status`, never `order:updated`. */
export type EventName =
  | 'order:new'
  | 'order:status'
  | 'order:removed'
  | 'payment:changed'
  | 'table:changed'
  | 'menu:changed'
  | 'metrics:update'
  | 'reservation:flag';

export type Room = 'menu' | 'kitchen' | 'pos' | 'admin' | `customer:${string}`;

export interface PublishedEvent {
  name: EventName;
  payload: unknown;
  rooms: Room[];
}

type Transport = (event: PublishedEvent) => void;

const transports = new Set<Transport>();

/** Attach a delivery mechanism (the socket server, or a test recorder). */
export function addTransport(transport: Transport): () => void {
  transports.add(transport);
  return () => transports.delete(transport);
}

export function publish(name: EventName, payload: unknown, opts: { rooms: Room[] }): void {
  const event = { name, payload, rooms: opts.rooms };
  for (const transport of transports) transport(event);
}
