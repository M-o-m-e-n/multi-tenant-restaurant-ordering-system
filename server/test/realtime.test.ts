import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { io as connect, type Socket } from 'socket.io-client';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { disconnectPrisma, prisma } from '../src/lib/prisma';
import { menuChanged } from '../src/modules/menu';
import { invalidateSettingsCache } from '../src/modules/settings';
import { createRealtime } from '../src/realtime';
import { loginAs, makeUser } from './helpers/auth';
import { resetDb } from './helpers/db';
import { seedMenu } from './helpers/menu';

const app = createApp({ rateLimits: false });

describe('realtime', () => {
  let http: Server;
  let realtime: ReturnType<typeof createRealtime>;
  let url: string;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    http = createServer(app);
    realtime = createRealtime(http);
    await new Promise<void>((resolve) => http.listen(0, resolve));
    url = `http://localhost:${(http.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await realtime.close();
    await new Promise((resolve) => http.close(resolve));
    await disconnectPrisma();
  });

  let menu: Awaited<ReturnType<typeof seedMenu>>;
  beforeEach(async () => {
    await resetDb();
    invalidateSettingsCache();
    menuChanged();
    menu = await seedMenu();
  });
  afterEach(() => {
    sockets.splice(0).forEach((s) => s.disconnect());
  });

  function open(token?: string): Promise<Socket> {
    const socket = connect(url, {
      auth: token ? { token } : {},
      transports: ['websocket'],
      forceNew: true,
    });
    sockets.push(socket);
    return new Promise((resolve, reject) => {
      socket.once('connect', () => resolve(socket));
      socket.once('connect_error', reject);
    });
  }

  function next<T>(socket: Socket, event: string, ms = 3000): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`no ${event} within ${ms} ms`)), ms);
      socket.once(event, (payload: T) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });
  }

  function silent(socket: Socket, event: string, ms = 400): Promise<boolean> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(true), ms);
      socket.once(event, () => {
        clearTimeout(timer);
        resolve(false);
      });
    });
  }

  it('I25: an anonymous socket connects and receives menu:changed when an item is 86’d (AC-7)', async () => {
    const guest = await open();
    const staff = await makeUser('STAFF');
    const { accessToken } = await loginAs(app, staff.email);

    const heard = next<{ itemId: string }>(guest, 'menu:changed');
    await request(app)
      .patch(`/api/v1/staff/menu/items/${menu.items.pizza.id}/availability`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ isAvailable: false })
      .expect(200);
    expect((await heard).itemId).toBe(menu.items.pizza.id);
  });

  it('rejects a present-but-invalid token rather than treating it as anonymous', async () => {
    await expect(open('not-a-token')).rejects.toMatchObject({ message: 'UNAUTHENTICATED' });
  });

  it('puts staff in the kitchen room and delivers order:new within 500 ms (KDS-02)', async () => {
    const staff = await makeUser('STAFF');
    const kitchen = await open((await loginAs(app, staff.email)).accessToken);
    const customer = await makeUser('CUSTOMER');
    const { accessToken } = await loginAs(app, customer.email);

    const started = Date.now();
    const heard = next<{ orderNumber: string; nextStatuses: string[] }>(kitchen, 'order:new', 500);
    await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        type: 'TAKEAWAY',
        customer: { name: 'Jo', phone: '+15550101' },
        items: [{ menuItemId: menu.items.lemonade.id, qty: 1 }],
      })
      .expect(201);
    const order = await heard;
    expect(Date.now() - started).toBeLessThan(500);
    expect(order.orderNumber).toBe('A-1001');
    // Staff screens get the staff view of the order.
    expect(order.nextStatuses).toEqual(['CONFIRMED', 'CANCELLED']);
  });

  it('never lets a customer into the kitchen, even by emitting the join itself', async () => {
    const customer = await makeUser('CUSTOMER');
    const { accessToken } = await loginAs(app, customer.email);
    const socket = await open(accessToken);
    socket.emit('join', 'kitchen');
    socket.emit('customer:watch', 'kitchen');

    const quiet = silent(socket, 'order:new');
    await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        type: 'TAKEAWAY',
        customer: { name: 'Jo', phone: '+15550101' },
        items: [{ menuItemId: menu.items.lemonade.id, qty: 1 }],
      })
      .expect(201);
    expect(await quiet).toBe(true);
  });

  it('lets only the owner watch an order, and tells them each status change (AC-2)', async () => {
    const owner = await makeUser('CUSTOMER');
    const stranger = await makeUser('CUSTOMER');
    const ownerLogin = await loginAs(app, owner.email);
    const strangerLogin = await loginAs(app, stranger.email);
    const staffToken = (await loginAs(app, (await makeUser('STAFF')).email)).accessToken;

    const placed = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
      .send({
        type: 'TAKEAWAY',
        customer: { name: 'Jo', phone: '+15550101' },
        items: [{ menuItemId: menu.items.lemonade.id, qty: 1 }],
      });
    const orderId = placed.body.id as string;

    const mine = await open(ownerLogin.accessToken);
    const theirs = await open(strangerLogin.accessToken);
    mine.emit('customer:watch', orderId);
    theirs.emit('customer:watch', orderId);
    await new Promise((r) => setTimeout(r, 150));

    const heard = next<{ to: string; order: { nextStatuses: string[] } }>(mine, 'order:status');
    const quiet = silent(theirs, 'order:status');
    await request(app)
      .patch(`/api/v1/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ to: 'CONFIRMED' })
      .expect(200);
    const event = await heard;
    expect(event.to).toBe('CONFIRMED');
    expect(event.order.nextStatuses).toEqual(['CANCELLED']);
    expect(await quiet).toBe(true);
  });

  it('broadcasts nothing for a write that rolled back (HLD §8.2)', async () => {
    const staff = await makeUser('STAFF');
    const kitchen = await open((await loginAs(app, staff.email)).accessToken);
    const customer = await makeUser('CUSTOMER');
    const { accessToken } = await loginAs(app, customer.email);
    await prisma().menuItem.update({
      where: { id: menu.items.lemonade.id },
      data: { isAvailable: false },
    });
    menuChanged();

    const quiet = silent(kitchen, 'order:new');
    await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        type: 'TAKEAWAY',
        customer: { name: 'Jo', phone: '+15550101' },
        items: [{ menuItemId: menu.items.lemonade.id, qty: 1 }],
      })
      .expect(409);
    expect(await quiet).toBe(true);
  });
});
