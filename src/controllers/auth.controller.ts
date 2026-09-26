import { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { successResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { LoginInput, RegisterInput } from '../types/auth';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as RegisterInput;
  const user = await authService.registerUser(input);

  res.status(201).json(
    successResponse('User registered successfully', { user })
  );
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as LoginInput;
  const result = await authService.loginUser(input);

  res.status(200).json(successResponse('Logged in successfully', result));
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  const user = await authService.getCurrentUser(req.user.id);

  res.status(200).json(successResponse('User retrieved successfully', { user }));
});
