import { Request, Response } from 'express';
import * as productService from '../services/product.service';
import { successResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import {
  CreateProductInput,
  ProductListQuery,
  UpdateProductInput,
} from '../types/product';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ProductListQuery;
  const result = await productService.listProducts(query);

  res.status(200).json(
    successResponse('Products retrieved successfully', result)
  );
});

export const getBySlug = asyncHandler(async (req: Request, res: Response) => {
  const slug = req.params.slug;
  if (!slug) {
    throw new ApiError(400, 'Product slug is required');
  }

  const product = await productService.getActiveProductBySlug(slug);
  res
    .status(200)
    .json(successResponse('Product retrieved successfully', product));
});

export const listAdmin = asyncHandler(async (_req: Request, res: Response) => {
  const products = await productService.listProductsForAdmin();
  res
    .status(200)
    .json(successResponse('Products retrieved successfully', products));
});

export const getAdminById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!id) {
    throw new ApiError(400, 'Product id is required');
  }

  const product = await productService.getProductByIdForAdmin(id);
  res
    .status(200)
    .json(successResponse('Product retrieved successfully', product));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CreateProductInput;
  const product = await productService.createProduct(input);

  res.status(201).json(successResponse('Product created successfully', product));
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!id) {
    throw new ApiError(400, 'Product id is required');
  }

  const input = req.body as UpdateProductInput;
  const product = await productService.updateProduct(id, input);

  res
    .status(200)
    .json(successResponse('Product updated successfully', product));
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!id) {
    throw new ApiError(400, 'Product id is required');
  }

  const product = await productService.archiveProduct(id);
  res
    .status(200)
    .json(successResponse('Product archived successfully', product));
});

export const uploadImage = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!id) {
    throw new ApiError(400, 'Product id is required');
  }

  if (!req.file) {
    throw new ApiError(400, 'Validation failed', [
      'image file is required (field name: image)',
    ]);
  }

  const alt =
    typeof req.body?.alt === 'string' ? req.body.alt.trim() : undefined;

  const product = await productService.addProductImage(
    id,
    { buffer: req.file.buffer, mimetype: req.file.mimetype },
    alt && alt.length > 0 ? alt : undefined
  );

  res
    .status(201)
    .json(successResponse('Product image uploaded successfully', product));
});

export const removeImage = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!id) {
    throw new ApiError(400, 'Product id is required');
  }

  const { publicId } = req.body as { publicId: string };
  const product = await productService.removeProductImage(id, publicId);

  res
    .status(200)
    .json(successResponse('Product image removed successfully', product));
});
