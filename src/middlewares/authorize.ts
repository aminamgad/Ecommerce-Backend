import { RequestHandler } from 'express';
import { User } from '../models/User';
import { UserRole } from '../types/auth';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

/**
 * Authorize against `req.user.role` from the JWT (no DB round-trip).
 * Prefer `requireAdmin` for sensitive admin mutations.
 */
export function requireRole(...allowedRoles: UserRole[]): RequestHandler {
  if (allowedRoles.length === 0) {
    throw new Error('requireRole requires at least one permitted role');
  }

  const allowed = new Set(allowedRoles);

  return (req, _res, next) => {
    try {
      if (!req.user) {
        throw new ApiError(401, 'Authentication required');
      }

      if (!allowed.has(req.user.role)) {
        throw new ApiError(403, 'Forbidden');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Re-validates admin role, isActive, and tokenVersion against the database.
 */
export const requireAdmin: RequestHandler = asyncHandler(
  async (req, _res, next) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }

    const user = await User.findById(req.user.id)
      .select('role isActive tokenVersion')
      .exec();

    if (!user || !user.isActive) {
      throw new ApiError(401, 'Authentication required');
    }

    if (user.tokenVersion !== req.user.tokenVersion) {
      throw new ApiError(401, 'Invalid or expired token');
    }

    if (user.role !== 'admin') {
      throw new ApiError(403, 'Forbidden');
    }

    req.user = {
      id: user._id.toString(),
      role: user.role,
      tokenVersion: user.tokenVersion,
    };

    next();
  }
);
