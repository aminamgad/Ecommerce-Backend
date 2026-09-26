import { AuthUser } from './auth';

declare global {
  namespace Express {
    interface Request {
      /** Set by `authenticate` middleware after a valid access token. */
      user?: AuthUser;
    }
  }
}

export {};
