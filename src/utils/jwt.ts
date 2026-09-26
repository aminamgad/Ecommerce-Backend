import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { ApiError } from './ApiError';
import { AccessTokenPayload, AuthUser, UserRole } from '../types/auth';

const ACCESS_ALGORITHMS: jwt.Algorithm[] = ['HS256'];

function isUserRole(value: unknown): value is UserRole {
  return value === 'customer' || value === 'admin';
}

function toAuthUser(payload: jwt.JwtPayload): AuthUser {
  const id = payload.sub;
  const role = payload.role;
  const tokenVersion = payload.tv;

  if (typeof id !== 'string' || id.length === 0) {
    throw new ApiError(401, 'Invalid or expired token');
  }

  if (!isUserRole(role)) {
    throw new ApiError(401, 'Invalid or expired token');
  }

  if (typeof tokenVersion !== 'number' || !Number.isInteger(tokenVersion)) {
    throw new ApiError(401, 'Invalid or expired token');
  }

  return {
    id,
    role,
    tokenVersion,
  };
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(
    {
      role: payload.role,
      tv: payload.tv,
    },
    env.jwtSecret,
    {
      algorithm: 'HS256',
      subject: payload.sub,
      expiresIn: env.jwtAccessExpiresInSec,
      issuer: env.jwtIssuer,
      audience: env.jwtAudience,
    }
  );
}

export function verifyAccessToken(token: string): AuthUser {
  try {
    const decoded = jwt.verify(token, env.jwtSecret, {
      algorithms: ACCESS_ALGORITHMS,
      issuer: env.jwtIssuer,
      audience: env.jwtAudience,
    });

    if (typeof decoded === 'string') {
      throw new ApiError(401, 'Invalid or expired token');
    }

    return toAuthUser(decoded);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof jwt.TokenExpiredError) {
      throw new ApiError(401, 'Token expired');
    }

    if (error instanceof jwt.JsonWebTokenError) {
      throw new ApiError(401, 'Invalid or expired token');
    }

    throw new ApiError(401, 'Invalid or expired token');
  }
}
