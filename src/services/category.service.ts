import { Types } from 'mongoose';
import { Category } from '../models/Category';
import { ApiError } from '../utils/ApiError';
import { slugify } from '../utils/slugify';
import {
  CategoryResponse,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '../types/category';

function isDuplicateKeyError(error: unknown, field: string): boolean {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('code' in error) ||
    (error as { code: unknown }).code !== 11000
  ) {
    return false;
  }

  const duplicate = error as {
    keyPattern?: Record<string, unknown>;
    keyValue?: Record<string, unknown>;
    message?: string;
  };

  if (duplicate.keyPattern && field in duplicate.keyPattern) {
    return true;
  }
  if (duplicate.keyValue && field in duplicate.keyValue) {
    return true;
  }

  return (
    typeof duplicate.message === 'string' && duplicate.message.includes(field)
  );
}

function assertValidObjectId(id: string): void {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid category id');
  }
}

function resolveSlug(name: string, explicitSlug?: string): string {
  const slug = explicitSlug && explicitSlug.length > 0 ? explicitSlug : slugify(name);

  if (!slug) {
    throw new ApiError(400, 'Validation failed', [
      'Unable to generate slug from name; provide an explicit slug',
    ]);
  }

  return slug;
}

export async function createCategory(
  input: CreateCategoryInput
): Promise<CategoryResponse> {
  const nameNormalized = input.name.toLowerCase();
  const slug = resolveSlug(input.name, input.slug);

  try {
    const category = await Category.create({
      name: input.name,
      nameNormalized,
      slug,
      description: input.description ?? null,
      image: input.image ?? null,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
    });

    return category.toSafeObject();
  } catch (error) {
    if (isDuplicateKeyError(error, 'nameNormalized')) {
      throw new ApiError(409, 'Category name is already in use');
    }
    if (isDuplicateKeyError(error, 'slug')) {
      throw new ApiError(409, 'Category slug is already in use');
    }
    throw error;
  }
}

export async function listActiveCategories(): Promise<CategoryResponse[]> {
  const categories = await Category.find({ isActive: true })
    .sort({ sortOrder: 1, name: 1 })
    .exec();

  return categories.map((category) => category.toSafeObject());
}

export async function listAllCategories(): Promise<CategoryResponse[]> {
  const categories = await Category.find()
    .sort({ sortOrder: 1, name: 1 })
    .exec();

  return categories.map((category) => category.toSafeObject());
}

export async function getActiveCategoryBySlug(
  slug: string
): Promise<CategoryResponse> {
  const normalized = slugify(slug);
  if (!normalized) {
    throw new ApiError(400, 'Invalid category slug');
  }

  const category = await Category.findOne({
    slug: normalized,
    isActive: true,
  }).exec();

  if (!category) {
    throw new ApiError(404, 'Category not found');
  }

  return category.toSafeObject();
}

export async function getCategoryById(id: string): Promise<CategoryResponse> {
  assertValidObjectId(id);

  const category = await Category.findById(id).exec();
  if (!category) {
    throw new ApiError(404, 'Category not found');
  }

  return category.toSafeObject();
}

export async function updateCategory(
  id: string,
  input: UpdateCategoryInput
): Promise<CategoryResponse> {
  assertValidObjectId(id);

  const category = await Category.findById(id).exec();
  if (!category) {
    throw new ApiError(404, 'Category not found');
  }

  if (input.name !== undefined) {
    category.name = input.name;
    category.nameNormalized = input.name.toLowerCase();
  }

  // Slug is stable on rename unless explicitly provided.
  if (input.slug !== undefined) {
    category.slug = resolveSlug(category.name, input.slug);
  }

  if (input.description !== undefined) {
    category.description = input.description;
  }
  if (input.image !== undefined) {
    category.image = input.image;
  }
  if (input.isActive !== undefined) {
    category.isActive = input.isActive;
  }
  if (input.sortOrder !== undefined) {
    category.sortOrder = input.sortOrder;
  }

  try {
    await category.save();
    return category.toSafeObject();
  } catch (error) {
    if (isDuplicateKeyError(error, 'nameNormalized')) {
      throw new ApiError(409, 'Category name is already in use');
    }
    if (isDuplicateKeyError(error, 'slug')) {
      throw new ApiError(409, 'Category slug is already in use');
    }
    throw error;
  }
}

/**
 * Soft-delete: deactivate the category.
 * Hard delete is avoided so product references remain valid when products exist.
 */
export async function deleteCategory(id: string): Promise<CategoryResponse> {
  assertValidObjectId(id);

  const category = await Category.findById(id).exec();
  if (!category) {
    throw new ApiError(404, 'Category not found');
  }

  category.isActive = false;
  await category.save();

  return category.toSafeObject();
}
