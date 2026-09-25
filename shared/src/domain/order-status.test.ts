import { describe, expect, it } from 'vitest';

import { ORDER_STATUSES, type OrderStatus, ROLES } from './enums';
import {
  canTransition,
  FORWARD_TRANSITION,
  nextStatuses,
  ORDER_TRANSITIONS,
  TERMINAL_STATUSES,
} from './order-status';

// LLD §10.1 state machine cases S1–S8.

describe('order state machine', () => {
  it('declares exactly ten edges', () => {
    expect(ORDER_TRANSITIONS).toHaveLength(10);
  });

  it('S1: allows every declared edge for each of its roles', () => {
    for (const t of ORDER_TRANSITIONS) {
      for (const role of t.roles) {
        expect(canTransition(t.from, t.to, role)).toBe(true);
      }
    }
  });

  it('S2: rejects backward moves', () => {
    expect(canTransition('PREPARING', 'CONFIRMED', 'ADMIN')).toBe(false);
    expect(canTransition('COMPLETED', 'PREPARING', 'ADMIN')).toBe(false);
  });

  it('S3: treats COMPLETED and CANCELLED as terminal', () => {
    for (const status of TERMINAL_STATUSES) {
      for (const role of ROLES) {
        expect(nextStatuses(status, role)).toEqual([]);
      }
      expect(ORDER_TRANSITIONS.some((t) => t.from === status)).toBe(false);
    }
  });

  it('S4: rejects skipping forward', () => {
    expect(canTransition('PLACED', 'PREPARING', 'STAFF')).toBe(false);
    expect(canTransition('CONFIRMED', 'READY', 'ADMIN')).toBe(false);
  });

  it('S5: gates roles per edge — a customer may cancel from PLACED but not confirm', () => {
    expect(canTransition('PLACED', 'CANCELLED', 'CUSTOMER')).toBe(true);
    expect(canTransition('PLACED', 'CONFIRMED', 'CUSTOMER')).toBe(false);
  });

  it('S6: stops a customer moving an order out of PREPARING', () => {
    for (const to of ORDER_STATUSES) {
      expect(canTransition('PREPARING', to, 'CUSTOMER')).toBe(false);
    }
  });

  it('S7: filters next statuses by role', () => {
    expect(nextStatuses('PLACED', 'STAFF')).toEqual(['CONFIRMED', 'CANCELLED']);
    expect(nextStatuses('PLACED', 'CUSTOMER')).toEqual(['CANCELLED']);
  });

  it('S8: has no forward step from a terminal status', () => {
    for (const status of TERMINAL_STATUSES) {
      expect(FORWARD_TRANSITION[status]).toBeNull();
    }
  });

  it('makes every forward step a legal staff edge', () => {
    for (const from of ORDER_STATUSES) {
      const to: OrderStatus | null = FORWARD_TRANSITION[from];
      if (to) expect(canTransition(from, to, 'STAFF')).toBe(true);
    }
  });
});
