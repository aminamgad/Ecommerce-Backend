import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError';
import { errorResponse } from '../utils/ApiResponse';

function isJsonParseError(err: unknown): boolean {
  if (!(err instanceof SyntaxError)) {
    return false;
  }

  const parseError = err as SyntaxError & {
    status?: number;
    type?: string;
  };

  return parseError.status === 400 || parseError.type === 'entity.parse.failed';
}

export function notFoundHandler(
  _req: Request,
  _res: Response,
  next: NextFunction
): void {
  next(new ApiError(404, 'Route not found'));
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json(errorResponse(err.message, err.errors));
    return;
  }

  if (isJsonParseError(err)) {
    res.status(400).json(errorResponse('Invalid JSON payload'));
    return;
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(err.errors).map((e) => e.message);
    res.status(400).json(errorResponse('Validation failed', errors));
    return;
  }

  console.error(err);

  res.status(500).json(errorResponse('Internal server error'));
}
