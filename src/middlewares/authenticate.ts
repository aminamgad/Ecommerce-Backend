import { RequestHandler } from 'express';
import { ApiError } from '../utils/ApiError';
import { verifyAccessToken } from '../utils/jwt';

const BEARER_PREFIX = 'Bearer ';

/**
 * Requires a valid access JWT in `Authorization: Bearer <token>`.
 * On success, sets `req.user` to `{ id, role, tokenVersion }`.
 */
export const authenticate: RequestHandler = (req, _res, next) => {
  try {
    const header = req.headers.authorization;

    if (!header) {
      throw new ApiError(401, 'Authentication required');
    }

    if (!header.startsWith(BEARER_PREFIX)) {
      throw new ApiError(401, 'Invalid authorization header');
    }

    const token = header.slice(BEARER_PREFIX.length).trim();

    if (!token) {
      throw new ApiError(401, 'Invalid authorization header');
    }

    req.user = verifyAccessToken(token);
    next();
  } catch (error) {
    next(error);
  }
};
