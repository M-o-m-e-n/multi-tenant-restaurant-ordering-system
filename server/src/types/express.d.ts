import type { Role } from '@ros/shared';

/** The caller as `authenticate` resolved it: role and name re-read from the database. */
export interface AuthUser {
  id: string;
  role: Role;
  name: string;
  /** The refresh-token family (session) the access token was issued for. */
  sessionId: string;
}

declare global {
  namespace Express {
    interface Request {
      /** Correlates the log line with the error response (API-CONTRACT §4). */
      id: string;
      user?: AuthUser;
    }
  }
}

export {};
