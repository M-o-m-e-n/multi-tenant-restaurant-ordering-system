import type { BranchDto, ContactMessageDto } from '@ros/shared';
import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { addTransport, type PublishedEvent } from '../src/lib/events';
import { disconnectPrisma, prisma } from '../src/lib/prisma';
import { loginAs, makeUser } from './helpers/auth';
import { resetDb } from './helpers/db';

const app = createApp({ rateLimits: false });
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
const LATE = Array.from({ length: 7 }, () => ({ open: 11, close: 26 }));

let admin: string;
let staff: string;
let branchId: string;
let events: PublishedEvent[];
let detach: () => void;

beforeEach(async () => {
  await resetDb();
  admin = (await loginAs(app, (await makeUser('ADMIN')).email)).accessToken;
  staff = (await loginAs(app, (await makeUser('STAFF')).email)).accessToken;
  const branch = await prisma().branch.create({
    data: {
      slug: 'riverside',
      nameAr: 'فرع النيل',
      nameEn: 'Riverside branch',
      addressAr: 'شارع النيل',
      addressEn: 'Atef El Sadat St',
      phones: ['+201112223333'],
      lat: 30.0707,
      lng: 31.2062,
      hours: LATE,
      features: ['ac-hall'],
      sortOrder: 2,
    },
  });
  await prisma().branch.create({
    data: {
      slug: 'closed',
      nameAr: 'فرع مغلق',
      nameEn: 'Closed branch',
      addressAr: 'x',
      addressEn: 'x',
      hours: LATE,
      isActive: false,
    },
  });
  branchId = branch.id;
  events = [];
  detach = addTransport((e) => events.push(e));
});
afterEach(() => detach());
afterAll(disconnectPrisma);

describe('branches (ADR-032)', () => {
  it('lists active branches publicly with position and hours past midnight', async () => {
    const res = await request(app).get('/api/v1/branches');
    expect(res.status).toBe(200);
    const [b, ...rest] = res.body.data as BranchDto[];
    expect(rest).toHaveLength(0);
    expect(b).toMatchObject({
      slug: 'riverside',
      name: { en: 'Riverside branch', ar: 'فرع النيل' },
      position: { lat: 30.0707, lng: 31.2062 },
      phones: ['+201112223333'],
      features: ['ac-hall'],
    });
    expect(b?.hours[0]).toEqual({ open: 11, close: 26 });
    // The DTO carries no Prisma-only columns.
    expect(b).not.toHaveProperty('nameEn');
    expect(b).not.toHaveProperty('updatedAt');
  });

  it('lets the admin move the pin, normalises phones and audits the change', async () => {
    const res = await request(app)
      .patch(`/api/v1/staff/branches/${branchId}`)
      .set(bearer(admin))
      .send({ lat: 30.06912, lng: 31.20455, phones: ['0111 222 3333'] });
    expect(res.status).toBe(200);
    expect(res.body.position).toEqual({ lat: 30.06912, lng: 31.20455 });
    expect(res.body.phones).toEqual(['+201112223333']);

    const audit = await prisma().auditLog.findFirst({ where: { action: 'BRANCH_UPDATE' } });
    expect(audit?.entityId).toBe(branchId);
    expect(audit?.diff).toMatchObject({
      before: { position: { lat: 30.0707, lng: 31.2062 } },
      after: { position: { lat: 30.06912, lng: 31.20455 } },
    });
  });

  it('rejects out-of-range coordinates, a lone latitude, unknown fields and an empty body', async () => {
    const patch = (body: object) =>
      request(app).patch(`/api/v1/staff/branches/${branchId}`).set(bearer(admin)).send(body);
    expect((await patch({ lat: 91, lng: 31 })).status).toBe(400);
    expect((await patch({ lat: 30.0 })).status).toBe(400);
    expect((await patch({ slug: 'x' })).status).toBe(400);
    expect((await patch({})).status).toBe(400);
    expect((await patch({ hours: [{ open: 20, close: 11 }] })).status).toBe(400);
  });

  it('answers 404 for an unknown branch and 403 for staff', async () => {
    const missing = await request(app)
      .patch('/api/v1/staff/branches/6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b')
      .set(bearer(admin))
      .send({ lat: 30, lng: 31 });
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('BRANCH_NOT_FOUND');
    const forbidden = await request(app).get('/api/v1/staff/branches').set(bearer(staff));
    expect(forbidden.status).toBe(403);
  });

  it('shows the admin inactive branches too', async () => {
    const res = await request(app).get('/api/v1/staff/branches').set(bearer(admin));
    expect((res.body.data as BranchDto[]).map((b) => b.slug)).toEqual(['closed', 'riverside']);
  });
});

describe('contact inbox (ADR-032)', () => {
  const message = () => ({
    name: 'محمد',
    phone: '010 0123 4567',
    kind: 'COMPLAINT',
    branchId,
    tableNumber: '7',
    visitDate: '2026-09-25',
    message: 'الأكل وصل بارد النهارده',
  });

  it('takes a message from anyone and tells the admin room after commit', async () => {
    const res = await request(app).post('/api/v1/contact').send(message());
    expect(res.status).toBe(201);
    expect(Object.keys(res.body)).toEqual(['id']);

    const row = await prisma().contactMessage.findUnique({ where: { id: res.body.id } });
    expect(row?.phone).toBe('+201001234567');
    expect(events).toEqual([
      {
        name: 'message:new',
        payload: { id: res.body.id, kind: 'COMPLAINT', unread: 1 },
        rooms: ['admin'],
      },
    ]);
  });

  it('refuses unknown fields, a bad phone, a short message and an unknown branch', async () => {
    const send = (body: object) => request(app).post('/api/v1/contact').send(body);
    expect((await send({ ...message(), readAt: '2026-01-01' })).status).toBe(400);
    expect((await send({ ...message(), phone: '123' })).status).toBe(400);
    expect((await send({ ...message(), message: 'hi' })).status).toBe(400);
    const ghost = await send({ ...message(), branchId: '6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b' });
    expect(ghost.status).toBe(404);
    expect(await prisma().contactMessage.count()).toBe(0);
  });

  it('lists newest first for the admin with an unread count, and marks read with an audit', async () => {
    await request(app).post('/api/v1/contact').send(message());
    const second = await request(app)
      .post('/api/v1/contact')
      .send({ ...message(), kind: 'SUGGESTION', message: 'زودوا صوص الثومية' });

    const inbox = await request(app).get('/api/v1/staff/messages').set(bearer(admin));
    expect(inbox.status).toBe(200);
    expect(inbox.body.unread).toBe(2);
    expect(inbox.body.meta).toEqual({ page: 1, limit: 25, total: 2 });
    const [first] = inbox.body.data as ContactMessageDto[];
    expect(first).toMatchObject({
      id: second.body.id,
      kind: 'SUGGESTION',
      branch: { id: branchId, name: { en: 'Riverside branch', ar: 'فرع النيل' } },
      tableNumber: '7',
      visitDate: '2026-09-25',
      readAt: null,
    });

    const read = await request(app)
      .patch(`/api/v1/staff/messages/${second.body.id}`)
      .set(bearer(admin))
      .send({ read: true });
    expect(read.status).toBe(200);
    expect(read.body.readAt).not.toBeNull();
    const unread = await request(app)
      .get('/api/v1/staff/messages?unread=true&kind=COMPLAINT')
      .set(bearer(admin));
    expect(unread.body.unread).toBe(1);
    expect(unread.body.data).toHaveLength(1);
    expect(await prisma().auditLog.count({ where: { action: 'CONTACT_MESSAGE_UPDATE' } })).toBe(1);
  });

  it('keeps the inbox from staff and anonymous callers', async () => {
    expect((await request(app).get('/api/v1/staff/messages')).status).toBe(401);
    expect((await request(app).get('/api/v1/staff/messages').set(bearer(staff))).status).toBe(403);
  });

  it('rate-limits the public form to 5 per 15 minutes per address', async () => {
    const limited = createApp({ rateLimits: true });
    for (let i = 0; i < 5; i++) {
      expect((await request(limited).post('/api/v1/contact').send(message())).status).toBe(201);
    }
    const res = await request(limited).post('/api/v1/contact').send(message());
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });
});
