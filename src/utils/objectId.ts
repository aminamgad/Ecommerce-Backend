import { Types } from 'mongoose';
import { ApiError } from './ApiError';

const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;

export function isStrictObjectId(value: string): boolean {
  return OBJECT_ID_REGEX.test(value) && Types.ObjectId.isValid(value);
}

export function assertStrictObjectId(
  value: string,
  message = 'Invalid id'
): void {
  if (!isStrictObjectId(value)) {
    throw new ApiError(400, message);
  }
}
