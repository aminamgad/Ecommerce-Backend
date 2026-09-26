import { ApiError } from '../utils/ApiError';
import { isStrictObjectId } from '../utils/objectId';
import { AddCartItemInput, MAX_CART_LINE_QUANTITY } from '../types/cart';

/**
 * Validate POST /api/v1/cart/items body.
 */
export function validateAddCartItemInput(body: unknown): AddCartItemInput {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'Invalid request body', [
      'Request body must be a JSON object',
    ]);
  }

  const raw = body as Record<string, unknown>;
  const errors: string[] = [];

  let productId: string | undefined;
  if (raw.productId === undefined || raw.productId === '') {
    errors.push('productId is required');
  } else if (typeof raw.productId !== 'string') {
    errors.push('productId must be a string');
  } else if (!isStrictObjectId(raw.productId)) {
    errors.push('productId must be a valid ObjectId');
  } else {
    productId = raw.productId;
  }

  let quantity: number | undefined;
  if (raw.quantity === undefined || raw.quantity === '') {
    errors.push('quantity is required');
  } else if (typeof raw.quantity !== 'number' || !Number.isInteger(raw.quantity)) {
    errors.push('quantity must be an integer');
  } else if (raw.quantity < 1) {
    errors.push('quantity must be greater than 0');
  } else if (raw.quantity > MAX_CART_LINE_QUANTITY) {
    errors.push(
      `quantity must be at most ${MAX_CART_LINE_QUANTITY} per request`
    );
  } else {
    quantity = raw.quantity;
  }

  if (errors.length > 0) {
    throw new ApiError(400, 'Validation failed', errors);
  }

  return {
    productId: productId as string,
    quantity: quantity as number,
  };
}
