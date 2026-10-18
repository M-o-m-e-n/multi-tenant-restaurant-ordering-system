import * as s from '@ros/shared';
import type { ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

/** Who may call an endpoint (LLD §5 legend: 🔓 public, 🔒 signed in, 🛎 staff, 🛠 admin). */
type Access = 'public' | 'user' | 'staff' | 'admin';

interface Endpoint {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  tag: string;
  summary: string;
  access: Access;
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  /** The success status; defaults to 200. */
  status?: number;
  idempotent?: boolean;
}

const P = '/api/v1';

/**
 * Every endpoint the server mounts, with the Zod schema it validates against
 * (LLD §5). `openapi.test.ts` fails if a route is added to Express without a
 * row here, so the document cannot drift from the code (NFR-M5).
 */
export const ENDPOINTS: Endpoint[] = [
  { method: 'get', path: '/health', tag: 'ops', summary: 'Liveness probe', access: 'public' },
  // Auth (§5.1)
  {
    method: 'post',
    path: `${P}/auth/register`,
    tag: 'auth',
    summary: 'Register a customer; sets the refresh cookie',
    access: 'public',
    body: s.registerSchema,
    status: 201,
  },
  {
    method: 'post',
    path: `${P}/auth/login`,
    tag: 'auth',
    summary: 'Sign in; returns an access token and sets the refresh cookie',
    access: 'public',
    body: s.loginSchema,
  },
  {
    method: 'post',
    path: `${P}/auth/refresh`,
    tag: 'auth',
    summary: 'Rotate the refresh cookie for a new access token (needs X-Refresh-Request)',
    access: 'public',
  },
  {
    method: 'post',
    path: `${P}/auth/logout`,
    tag: 'auth',
    summary: 'End this session',
    access: 'public',
  },
  {
    method: 'post',
    path: `${P}/auth/logout-all`,
    tag: 'auth',
    summary: 'End every session of the caller',
    access: 'user',
  },
  {
    method: 'get',
    path: `${P}/auth/me`,
    tag: 'auth',
    summary: 'The signed-in user',
    access: 'user',
  },
  {
    method: 'get',
    path: `${P}/auth/sessions`,
    tag: 'auth',
    summary: 'Active sessions of the caller',
    access: 'user',
  },
  {
    method: 'delete',
    path: `${P}/auth/sessions/{familyId}`,
    tag: 'auth',
    summary: 'Revoke one session',
    access: 'user',
  },
  // Users
  { method: 'get', path: `${P}/staff/users`, tag: 'users', summary: 'List users', access: 'admin' },
  {
    method: 'post',
    path: `${P}/staff/users`,
    tag: 'users',
    summary: 'Create a staff or admin user',
    access: 'admin',
    body: s.createStaffUserSchema,
    status: 201,
  },
  {
    method: 'patch',
    path: `${P}/staff/users/{id}`,
    tag: 'users',
    summary: 'Change role or disable a user',
    access: 'admin',
    body: s.updateUserSchema,
  },
  // Menu (§5.2)
  {
    method: 'get',
    path: `${P}/menu`,
    tag: 'menu',
    summary: 'Public menu with availability',
    access: 'public',
  },
  {
    method: 'get',
    path: `${P}/menu/items/{id}`,
    tag: 'menu',
    summary: 'One item with its modifier groups',
    access: 'public',
  },
  {
    method: 'get',
    path: `${P}/staff/menu`,
    tag: 'menu',
    summary: 'Full menu for editing, including inactive rows',
    access: 'admin',
  },
  {
    method: 'post',
    path: `${P}/staff/menu/categories`,
    tag: 'menu',
    summary: 'Create a category',
    access: 'admin',
    body: s.createCategorySchema,
    status: 201,
  },
  {
    method: 'patch',
    path: `${P}/staff/menu/categories/{id}`,
    tag: 'menu',
    summary: 'Update a category',
    access: 'admin',
    body: s.updateCategorySchema,
  },
  {
    method: 'delete',
    path: `${P}/staff/menu/categories/{id}`,
    tag: 'menu',
    summary: 'Retire a category',
    access: 'admin',
  },
  {
    method: 'post',
    path: `${P}/staff/menu/items`,
    tag: 'menu',
    summary: 'Create an item',
    access: 'admin',
    body: s.createItemSchema,
    status: 201,
  },
  {
    method: 'patch',
    path: `${P}/staff/menu/items/{id}`,
    tag: 'menu',
    summary: 'Update an item',
    access: 'admin',
    body: s.updateItemSchema,
  },
  {
    method: 'delete',
    path: `${P}/staff/menu/items/{id}`,
    tag: 'menu',
    summary: 'Retire an item',
    access: 'admin',
  },
  {
    method: 'patch',
    path: `${P}/staff/menu/items/{id}/availability`,
    tag: 'menu',
    summary: '86 or restore an item',
    access: 'staff',
    body: s.availabilitySchema,
  },
  {
    method: 'post',
    path: `${P}/staff/menu/items/{id}/modifier-groups`,
    tag: 'menu',
    summary: 'Attach a modifier group to an item',
    access: 'admin',
    body: s.attachGroupSchema,
    status: 201,
  },
  {
    method: 'delete',
    path: `${P}/staff/menu/items/{id}/modifier-groups/{groupId}`,
    tag: 'menu',
    summary: 'Detach a modifier group',
    access: 'admin',
  },
  {
    method: 'post',
    path: `${P}/staff/menu/modifier-groups`,
    tag: 'menu',
    summary: 'Create a modifier group',
    access: 'admin',
    body: s.modifierGroupSchema,
    status: 201,
  },
  {
    method: 'patch',
    path: `${P}/staff/menu/modifier-groups/{id}`,
    tag: 'menu',
    summary: 'Update a modifier group',
    access: 'admin',
    body: s.updateModifierGroupSchema,
  },
  {
    method: 'delete',
    path: `${P}/staff/menu/modifier-groups/{id}`,
    tag: 'menu',
    summary: 'Retire a modifier group',
    access: 'admin',
  },
  {
    method: 'post',
    path: `${P}/staff/menu/modifier-groups/{id}/items`,
    tag: 'menu',
    summary: 'Add an option to a group',
    access: 'admin',
    body: s.modifierItemSchema,
    status: 201,
  },
  {
    method: 'patch',
    path: `${P}/staff/menu/modifier-groups/{id}/items/{itemId}`,
    tag: 'menu',
    summary: 'Update an option',
    access: 'admin',
    body: s.updateModifierItemSchema,
  },
  {
    method: 'delete',
    path: `${P}/staff/menu/modifier-groups/{id}/items/{itemId}`,
    tag: 'menu',
    summary: 'Retire an option',
    access: 'admin',
  },
  // Orders (§5.3)
  {
    method: 'post',
    path: `${P}/orders/preview`,
    tag: 'orders',
    summary: 'Authoritative totals for a cart; persists nothing',
    access: 'public',
    body: s.previewOrderSchema,
  },
  {
    method: 'post',
    path: `${P}/orders`,
    tag: 'orders',
    summary: 'Place an order',
    access: 'user',
    body: s.createOrderSchema,
    status: 201,
    idempotent: true,
  },
  {
    method: 'get',
    path: `${P}/orders`,
    tag: 'orders',
    summary: 'Role-scoped order list',
    access: 'user',
    query: s.listOrdersQuerySchema,
  },
  {
    method: 'get',
    path: `${P}/orders/{id}`,
    tag: 'orders',
    summary: 'One order (owner or staff)',
    access: 'user',
  },
  {
    method: 'get',
    path: `${P}/orders/{id}/events`,
    tag: 'orders',
    summary: 'Status timeline',
    access: 'user',
  },
  {
    method: 'get',
    path: `${P}/orders/{id}/receipt`,
    tag: 'orders',
    summary: 'Receipt built from snapshots',
    access: 'user',
  },
  {
    method: 'post',
    path: `${P}/orders/{id}/items`,
    tag: 'orders',
    summary: 'Append items while PLACED/CONFIRMED/PREPARING',
    access: 'user',
    body: s.appendItemsSchema,
  },
  {
    method: 'patch',
    path: `${P}/orders/{id}/status`,
    tag: 'orders',
    summary: 'Move the order through the state machine',
    access: 'staff',
    body: s.transitionSchema,
  },
  {
    method: 'patch',
    path: `${P}/orders/{id}/delivery`,
    tag: 'orders',
    summary: 'Assign a driver or advance the delivery',
    access: 'staff',
    body: s.updateDeliverySchema,
  },
  {
    method: 'post',
    path: `${P}/orders/{id}/cancel`,
    tag: 'orders',
    summary: 'Cancel while PLACED/CONFIRMED',
    access: 'user',
    body: s.cancelOrderSchema,
  },
  // Payments (§5.4)
  {
    method: 'get',
    path: `${P}/payments/config`,
    tag: 'payments',
    summary: 'Whether card payment is on, and the publishable key',
    access: 'public',
  },
  {
    method: 'post',
    path: `${P}/payments/intent`,
    tag: 'payments',
    summary: 'Stripe PaymentIntent for the balance or a split amount',
    access: 'user',
    body: s.createIntentSchema,
    idempotent: true,
  },
  {
    method: 'post',
    path: `${P}/payments/webhook`,
    tag: 'payments',
    summary: 'Stripe webhook (raw body, signed)',
    access: 'public',
  },
  {
    method: 'post',
    path: `${P}/payments/cash`,
    tag: 'payments',
    summary: 'Record a cash payment and tip',
    access: 'staff',
    body: s.cashPaymentSchema,
    status: 201,
  },
  {
    method: 'post',
    path: `${P}/payments/refund`,
    tag: 'payments',
    summary: 'Refund a completed or cancelled order',
    access: 'admin',
    body: s.refundSchema,
  },
  {
    method: 'get',
    path: `${P}/payments/order/{orderId}`,
    tag: 'payments',
    summary: 'Payment records of an order',
    access: 'user',
  },
  // Tables & reservations (§5.5)
  { method: 'get', path: `${P}/tables`, tag: 'tables', summary: 'Table map', access: 'staff' },
  {
    method: 'post',
    path: `${P}/tables`,
    tag: 'tables',
    summary: 'Create a table',
    access: 'admin',
    body: s.createTableSchema,
    status: 201,
  },
  {
    method: 'patch',
    path: `${P}/tables/{id}`,
    tag: 'tables',
    summary: 'Update status (staff) or number/seats/active (admin)',
    access: 'staff',
    body: s.updateTableSchema,
  },
  {
    method: 'post',
    path: `${P}/tables/{id}/regenerate-qr`,
    tag: 'tables',
    summary: 'Issue a new QR token',
    access: 'admin',
  },
  {
    method: 'get',
    path: `${P}/tables/{id}/qr.{format}`,
    tag: 'tables',
    summary: 'Printable QR code (svg or png)',
    access: 'admin',
  },
  {
    method: 'get',
    path: `${P}/tables/qr/{token}`,
    tag: 'tables',
    summary: 'Read-only resolve of a QR token',
    access: 'public',
  },
  {
    method: 'post',
    path: `${P}/tables/sessions`,
    tag: 'tables',
    summary: 'Open the dine-in session behind a QR scan',
    access: 'public',
    body: s.openSessionSchema,
    status: 201,
  },
  {
    method: 'post',
    path: `${P}/tables/{id}/close`,
    tag: 'tables',
    summary: 'SEATED → DIRTY when no order is open',
    access: 'staff',
  },
  {
    method: 'post',
    path: `${P}/tables/{id}/clean`,
    tag: 'tables',
    summary: 'DIRTY → FREE',
    access: 'staff',
  },
  {
    method: 'post',
    path: `${P}/reservations`,
    tag: 'reservations',
    summary: 'Book a table',
    access: 'user',
    body: s.createReservationSchema,
    status: 201,
  },
  {
    method: 'get',
    path: `${P}/reservations`,
    tag: 'reservations',
    summary: 'Bookings on a business date',
    access: 'staff',
    query: s.listReservationsQuerySchema,
  },
  {
    method: 'patch',
    path: `${P}/reservations/{id}`,
    tag: 'reservations',
    summary: 'Seat or cancel a booking',
    access: 'staff',
    body: s.updateReservationSchema,
  },
  // Branches & the contact inbox (ADR-032)
  {
    method: 'get',
    path: `${P}/branches`,
    tag: 'branches',
    summary: 'Active branches: address, phones, hours and map position',
    access: 'public',
  },
  {
    method: 'get',
    path: `${P}/staff/branches`,
    tag: 'branches',
    summary: 'Every branch, inactive ones included',
    access: 'admin',
  },
  {
    method: 'patch',
    path: `${P}/staff/branches/{id}`,
    tag: 'branches',
    summary: 'Correct a branch or move its map pin',
    access: 'admin',
    body: s.updateBranchSchema,
  },
  {
    method: 'post',
    path: `${P}/contact`,
    tag: 'contact',
    summary: 'Send a complaint, suggestion or question (rate-limited)',
    access: 'public',
    body: s.createContactMessageSchema,
    status: 201,
  },
  {
    method: 'get',
    path: `${P}/staff/messages`,
    tag: 'contact',
    summary: 'The feedback inbox, newest first, with the unread count',
    access: 'admin',
    query: s.listContactMessagesQuerySchema,
  },
  {
    method: 'patch',
    path: `${P}/staff/messages/{id}`,
    tag: 'contact',
    summary: 'Mark a message read or unread',
    access: 'admin',
    body: s.updateContactMessageSchema,
  },
  // Discounts & settings (§5.6)
  {
    method: 'post',
    path: `${P}/discounts/validate`,
    tag: 'discounts',
    summary: 'Check a code against a subtotal',
    access: 'user',
    body: s.validateDiscountSchema,
  },
  {
    method: 'get',
    path: `${P}/staff/discounts`,
    tag: 'discounts',
    summary: 'List discounts',
    access: 'admin',
  },
  {
    method: 'post',
    path: `${P}/staff/discounts`,
    tag: 'discounts',
    summary: 'Create a discount',
    access: 'admin',
    body: s.createDiscountSchema,
    status: 201,
  },
  {
    method: 'patch',
    path: `${P}/staff/discounts/{id}`,
    tag: 'discounts',
    summary: 'Update a discount',
    access: 'admin',
    body: s.updateDiscountSchema,
  },
  {
    method: 'delete',
    path: `${P}/staff/discounts/{id}`,
    tag: 'discounts',
    summary: 'Deactivate a discount',
    access: 'admin',
  },
  {
    method: 'get',
    path: `${P}/settings`,
    tag: 'settings',
    summary: 'Public pricing settings and timezone',
    access: 'public',
  },
  {
    method: 'get',
    path: `${P}/settings/kds`,
    tag: 'settings',
    summary: 'KDS ageing thresholds',
    access: 'staff',
  },
  {
    method: 'get',
    path: `${P}/staff/settings`,
    tag: 'settings',
    summary: 'Full settings',
    access: 'admin',
  },
  {
    method: 'put',
    path: `${P}/staff/settings`,
    tag: 'settings',
    summary: 'Replace the full settings set',
    access: 'admin',
    body: s.updateSettingsSchema,
  },
  // Reports & dashboard (§5.7, §5.8)
  {
    method: 'get',
    path: `${P}/reports/summary`,
    tag: 'reports',
    summary: 'Orders, net sales, AOV and pass-through lines',
    access: 'admin',
    query: s.reportRangeSchema,
  },
  {
    method: 'get',
    path: `${P}/reports/revenue-by-day`,
    tag: 'reports',
    summary: 'Net sales per business date',
    access: 'admin',
    query: s.reportRangeSchema,
  },
  {
    method: 'get',
    path: `${P}/reports/top-items`,
    tag: 'reports',
    summary: 'Best sellers by quantity or revenue',
    access: 'admin',
    query: s.topItemsQuerySchema,
  },
  {
    method: 'get',
    path: `${P}/reports/peak-hours`,
    tag: 'reports',
    summary: 'Orders per local hour',
    access: 'admin',
    query: s.reportRangeSchema,
  },
  {
    method: 'get',
    path: `${P}/reports/breakdowns`,
    tag: 'reports',
    summary: 'By order type and by payment method',
    access: 'admin',
    query: s.reportRangeSchema,
  },
  {
    method: 'get',
    path: `${P}/reports/cancellations`,
    tag: 'reports',
    summary: 'Cancellations and refunds',
    access: 'admin',
    query: s.reportRangeSchema,
  },
  {
    method: 'get',
    path: `${P}/dashboard/today`,
    tag: 'reports',
    summary: "Today's live figures",
    access: 'admin',
  },
];

const json = (schema: ZodTypeAny) =>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- ZodTypeAny is any-typed by design
  zodToJsonSchema(schema, { target: 'openApi3', $refStrategy: 'none' }) as Record<string, unknown>;

function queryParameters(schema: ZodTypeAny) {
  const body = json(schema) as { properties?: Record<string, unknown>; required?: string[] };
  return Object.entries(body.properties ?? {}).map(([name, schemaOf]) => ({
    name,
    in: 'query',
    required: body.required?.includes(name) ?? false,
    schema: schemaOf,
  }));
}

const ACCESS_NOTE: Record<Access, string> = {
  public: 'Public.',
  user: 'Any signed-in user; ownership is checked by the service.',
  staff: 'STAFF or ADMIN.',
  admin: 'ADMIN only.',
};

/** Build the OpenAPI 3.0 document from the endpoint table and the shared Zod schemas. */
export function buildOpenApi(version: string): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const e of ENDPOINTS) {
    const params = [...e.path.matchAll(/\{(\w+)\}/g)].map((m) => ({
      name: m[1],
      in: 'path',
      required: true,
      schema: { type: 'string' },
    }));
    const operation: Record<string, unknown> = {
      tags: [e.tag],
      summary: e.summary,
      description: ACCESS_NOTE[e.access],
      ...(e.access === 'public' ? { security: [] } : {}),
      parameters: [
        ...params,
        ...(e.query ? queryParameters(e.query) : []),
        ...(e.idempotent
          ? [{ name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string' } }]
          : []),
      ],
      ...(e.body
        ? {
            requestBody: {
              required: true,
              content: { 'application/json': { schema: json(e.body) } },
            },
          }
        : {}),
      responses: {
        [String(e.status ?? 200)]: { description: 'Success' },
        default: { $ref: '#/components/responses/Error' },
      },
    };
    (paths[e.path] ??= {})[e.method] = operation;
  }
  return {
    openapi: '3.0.3',
    info: {
      title: 'Restaurant Ordering System API',
      version,
      description:
        'Generated from the shared Zod schemas (`npm run openapi -w server`). Money is integer cents; rates are basis points. The spec of record is docs/LLD.md §5.',
    },
    servers: [{ url: 'http://localhost:4000' }],
    security: [{ bearer: [] }],
    paths,
    components: {
      securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      responses: {
        Error: {
          description: 'Error envelope',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['error'],
                properties: {
                  error: {
                    type: 'object',
                    required: ['code', 'message', 'requestId'],
                    properties: {
                      code: { type: 'string' },
                      message: { type: 'string' },
                      details: { type: 'object' },
                      requestId: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}
