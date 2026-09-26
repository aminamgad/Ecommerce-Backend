import { ApiError } from '../utils/ApiError';
import { LoginInput, RegisterInput } from '../types/auth';

/** bcrypt only uses the first 72 bytes of the password. */
export const BCRYPT_MAX_PASSWORD_BYTES = 72;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegisterInput(body: unknown): RegisterInput {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'Invalid request body', [
      'Request body must be a JSON object',
    ]);
  }

  const { name, email, password } = body as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof name !== 'string') {
    errors.push('Name is required');
  } else if (name.trim().length < 2) {
    errors.push('Name must be at least 2 characters');
  } else if (name.trim().length > 100) {
    errors.push('Name must be at most 100 characters');
  }

  if (typeof email !== 'string') {
    errors.push('Email is required');
  } else if (email.trim().length === 0) {
    errors.push('Email is required');
  } else if (!EMAIL_REGEX.test(email.trim().toLowerCase())) {
    errors.push('Email must be a valid email address');
  } else if (email.trim().length > 255) {
    errors.push('Email must be at most 255 characters');
  }

  if (typeof password !== 'string') {
    errors.push('Password is required');
  } else {
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters');
    }
    if (password.length > 128) {
      errors.push('Password must be at most 128 characters');
    }
    if (Buffer.byteLength(password, 'utf8') > BCRYPT_MAX_PASSWORD_BYTES) {
      errors.push(
        `Password must be at most ${BCRYPT_MAX_PASSWORD_BYTES} bytes`
      );
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      errors.push('Password must contain at least one letter and one number');
    }
  }

  if (errors.length > 0) {
    throw new ApiError(400, 'Validation failed', errors);
  }

  return {
    name: (name as string).trim(),
    email: (email as string).trim().toLowerCase(),
    password: password as string,
  };
}

export function validateLoginInput(body: unknown): LoginInput {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'Invalid request body', [
      'Request body must be a JSON object',
    ]);
  }

  const { email, password } = body as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof email !== 'string' || email.trim().length === 0) {
    errors.push('Email is required');
  } else if (!EMAIL_REGEX.test(email.trim().toLowerCase())) {
    errors.push('Email must be a valid email address');
  }

  if (typeof password !== 'string' || password.length === 0) {
    errors.push('Password is required');
  } else {
    if (password.length > 128) {
      errors.push('Password must be at most 128 characters');
    }
    if (Buffer.byteLength(password, 'utf8') > BCRYPT_MAX_PASSWORD_BYTES) {
      errors.push(
        `Password must be at most ${BCRYPT_MAX_PASSWORD_BYTES} bytes`
      );
    }
  }

  if (errors.length > 0) {
    throw new ApiError(400, 'Validation failed', errors);
  }

  return {
    email: (email as string).trim().toLowerCase(),
    password: password as string,
  };
}
