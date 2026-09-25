import type { AuthResponse, LoginDto, RegisterDto, Role, UserDto } from '@ros/shared';
import { create } from 'zustand';

import { api, onSessionEnd, refreshAccessToken, setAccessToken } from '../../shared/api/client';
import { reconnectSocket } from '../../shared/realtime/socket';

type Status = 'unknown' | 'authenticated' | 'anonymous';

interface AuthState {
  status: Status;
  user: UserDto | null;
  /** Why the last session ended, when it ended on its own (SESSION_REVOKED, ...). */
  endedBecause: string | null;
  bootstrap: () => Promise<void>;
  login: (dto: LoginDto) => Promise<UserDto>;
  register: (dto: RegisterDto) => Promise<UserDto>;
  logout: () => Promise<void>;
}

/**
 * Who is signed in. Deliberately **not** persisted: the access token lives in
 * the API client's memory, and a reload recovers the session by calling
 * /auth/refresh with the httpOnly cookie (AUTH-12, AC-22).
 */
export const useAuth = create<AuthState>()((set) => {
  onSessionEnd((code) => {
    set({ status: 'anonymous', user: null, endedBecause: code });
    reconnectSocket();
  });

  const signedIn = (res: AuthResponse): UserDto => {
    setAccessToken(res.accessToken);
    set({ status: 'authenticated', user: res.user, endedBecause: null });
    // The socket re-handshakes as this user, joining the rooms their role allows.
    reconnectSocket();
    return res.user;
  };

  return {
    status: 'unknown',
    user: null,
    endedBecause: null,

    bootstrap: async () => {
      try {
        await refreshAccessToken();
        const user = await api<UserDto>('/auth/me');
        set({ status: 'authenticated', user });
        reconnectSocket();
      } catch {
        setAccessToken(null);
        set({ status: 'anonymous', user: null });
      }
    },

    login: async (dto) =>
      signedIn(
        await api<AuthResponse>('/auth/login', { method: 'POST', body: dto, anonymous: true }),
      ),

    register: async (dto) =>
      signedIn(
        await api<AuthResponse>('/auth/register', { method: 'POST', body: dto, anonymous: true }),
      ),

    logout: async () => {
      try {
        await api('/auth/logout', { method: 'POST', anonymous: true });
      } finally {
        setAccessToken(null);
        set({ status: 'anonymous', user: null, endedBecause: null });
        reconnectSocket();
      }
    },
  };
});

/** Where each role lands after signing in without a return path. */
export function homeFor(role: Role): string {
  switch (role) {
    case 'ADMIN':
      return '/admin';
    case 'STAFF':
      return '/kitchen';
    case 'CUSTOMER':
      return '/menu';
    default: {
      const exhaustive: never = role;
      return exhaustive;
    }
  }
}
