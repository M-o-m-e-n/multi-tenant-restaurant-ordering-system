import type { Server as HttpServer } from 'node:http';

import { Server, type Socket } from 'socket.io';
import { z } from 'zod';

import { getEnv } from '../config/env';
import { addTransport } from '../lib/events';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { resolveUser } from '../middleware/authenticate';
import type { AuthUser } from '../types/express';

interface SocketData {
  user?: AuthUser;
}

type RosSocket = Socket<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  SocketData
>;

const orderId = z.string().uuid();

/**
 * Socket.IO on the API's HTTP server (LLD §4.9, §6).
 *
 * Authentication is optional by design: no token connects anonymously into the
 * `menu` room only, so a guest still sees an 86 in real time (BROWSE-01, AC-7);
 * a token that is present but invalid is rejected. Every privileged room is
 * joined server-side after a role or ownership check — a client can never
 * self-join `kitchen` (NFR-S4).
 */
export function createRealtime(httpServer: HttpServer): { io: Server; close: () => Promise<void> } {
  const io = new Server(httpServer, {
    cors: { origin: getEnv().CLIENT_ORIGINS, credentials: true },
    serveClient: false,
  });

  io.use((socket: RosSocket, next) => {
    const token: unknown = (socket.handshake.auth as Record<string, unknown> | undefined)?.token;
    if (token === undefined || token === null || token === '') {
      next();
      return;
    }
    if (typeof token !== 'string') {
      next(new Error('UNAUTHENTICATED'));
      return;
    }
    resolveUser(token)
      .then((user) => {
        socket.data.user = user;
        next();
      })
      .catch((err: unknown) => {
        const code = (err as { code?: string }).code ?? 'UNAUTHENTICATED';
        next(new Error(code));
      });
  });

  io.on('connection', (socket: RosSocket) => {
    void socket.join('menu');
    const user = socket.data.user;
    if (!user) return;

    if (user.role === 'STAFF' || user.role === 'ADMIN') void socket.join(['kitchen', 'pos']);
    if (user.role === 'ADMIN') void socket.join('admin');

    // The only client-initiated join, and only for the order's owner (API-CONTRACT §17).
    socket.on('customer:watch' as never, (raw: unknown) => {
      const parsed = orderId.safeParse(raw);
      if (!parsed.success) return;
      void prisma()
        .order.findUnique({ where: { id: parsed.data }, select: { userId: true } })
        .then((order) => {
          const allowed = order && (order.userId === user.id || user.role !== 'CUSTOMER');
          if (allowed) void socket.join(`customer:${parsed.data}`);
        })
        .catch((err: unknown) => logger().warn({ err }, 'customer:watch lookup failed'));
    });
  });

  // The transport behind events.publish; services have already committed.
  const detach = addTransport((event) => {
    io.to(event.rooms).emit(event.name, event.payload);
  });

  return {
    io,
    close: () =>
      new Promise<void>((resolve) => {
        detach();
        void io.close(() => resolve());
      }),
  };
}
