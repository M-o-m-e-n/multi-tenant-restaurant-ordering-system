import { io, type Socket } from 'socket.io-client';

import { getAccessToken, refreshAccessToken, setAccessToken } from '../api/client';

let socket: Socket | null = null;

/**
 * The one socket (CODING-STANDARDS §13). It connects anonymously when signed
 * out — guests still get menu:changed (AC-7) — and presents the in-memory
 * access token when signed in. The token is read at every (re)connect, so a
 * silent refresh is picked up; an expired one triggers a refresh and a retry.
 */
export function getSocket(): Socket {
  if (socket) return socket;
  const s = io({
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    auth: (cb) => {
      const token = getAccessToken();
      cb(token ? { token } : {});
    },
  });

  s.on('connect_error', (err) => {
    if (err.message !== 'UNAUTHENTICATED' && err.message !== 'ACCOUNT_DISABLED') return;
    // A stale token is routine after 15 minutes: refresh and reconnect. If the
    // session is gone, fall back to an anonymous socket rather than looping.
    refreshAccessToken()
      .catch(() => setAccessToken(null))
      .finally(() => {
        if (err.message === 'ACCOUNT_DISABLED') setAccessToken(null);
        s.connect();
      });
  });

  socket = s;
  return s;
}

/** Reconnect so the server re-evaluates who this socket belongs to (after login or logout). */
export function reconnectSocket(): void {
  if (!socket) return;
  socket.disconnect();
  socket.connect();
}
