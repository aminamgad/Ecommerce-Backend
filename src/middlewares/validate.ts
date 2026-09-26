import { RequestHandler } from 'express';
import { ApiError } from '../utils/ApiError';

type ValidatorFn = (input: unknown) => unknown;

export function validateBody(validator: ValidatorFn): RequestHandler {
  return (req, _res, next) => {
    try {
      req.body = validator(req.body);
      next();
    } catch (error) {
      next(
        error instanceof ApiError ? error : new ApiError(400, 'Validation failed')
      );
    }
  };
}

export function validateQuery(validator: ValidatorFn): RequestHandler {
  return (req, _res, next) => {
    try {
      req.query = validator(req.query) as typeof req.query;
      next();
    } catch (error) {
      next(
        error instanceof ApiError ? error : new ApiError(400, 'Validation failed')
      );
    }
  };
}
