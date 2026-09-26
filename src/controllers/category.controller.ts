import { Request, Response } from 'express';
import * as categoryService from '../services/category.service';
import { successResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import {
  CreateCategoryInput,
  UpdateCategoryInput,
} from '../types/category';

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CreateCategoryInput;
  const category = await categoryService.createCategory(input);

  res.status(201).json(
    successResponse('Category created successfully', { category })
  );
});

export const listPublic = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await categoryService.listActiveCategories();

  res.status(200).json(
    successResponse('Categories retrieved successfully', { categories })
  );
});

export const getPublicBySlug = asyncHandler(
  async (req: Request, res: Response) => {
    const slug = req.params.slug ?? '';
    const category = await categoryService.getActiveCategoryBySlug(slug);

    res.status(200).json(
      successResponse('Category retrieved successfully', { category })
    );
  }
);

export const listAdmin = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await categoryService.listAllCategories();

  res.status(200).json(
    successResponse('Categories retrieved successfully', { categories })
  );
});

export const getAdminById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id ?? '';
  const category = await categoryService.getCategoryById(id);

  res.status(200).json(
    successResponse('Category retrieved successfully', { category })
  );
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id ?? '';
  const input = req.body as UpdateCategoryInput;
  const category = await categoryService.updateCategory(id, input);

  res.status(200).json(
    successResponse('Category updated successfully', { category })
  );
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id ?? '';
  const category = await categoryService.deleteCategory(id);

  res.status(200).json(
    successResponse('Category deactivated successfully', { category })
  );
});
