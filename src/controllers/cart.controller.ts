import { Request, Response } from 'express';
import * as cartService from '../services/cart.service';
import { successResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { AddCartItemInput } from '../types/cart';

export const addItem = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  const input = req.body as AddCartItemInput;
  const cart = await cartService.addCartItem(req.user.id, input);

  res.status(200).json(successResponse('Item added to cart successfully', { cart }));
});
