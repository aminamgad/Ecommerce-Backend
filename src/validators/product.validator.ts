import { ApiError } from '../utils/ApiError';
import {
  CreateProductInput,
  ProductListQuery,
  UpdateProductInput,
} from '../types/product';
import { slugify } from '../utils/slugify';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_SEARCH_LENGTH = 100;

/** Allowed sort tokens → Mongo sort object is applied in the service. */
export const PRODUCT_LIST_SORT_OPTIONS = [
  'price',
  '-price',
  'createdAt',
  '-createdAt',
  'name',
  '-name',
] as const;

export type ProductListSortOption = (typeof PRODUCT_LIST_SORT_OPTIONS)[number];

function parsePositiveInt(
  value: unknown,
  field: string,
  errors: string[]
): number | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }

  if (typeof value !== 'string' && typeof value !== 'number') {
    errors.push(`${field} must be an integer`);
    return undefined;
  }

  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed)) {
    errors.push(`${field} must be an integer`);
    return undefined;
  }

  return parsed;
}

/**
 * Validate and normalize GET /products query params.
 */
export function validateProductListQuery(query: unknown): ProductListQuery {
  if (query === null || typeof query !== 'object' || Array.isArray(query)) {
    throw new ApiError(400, 'Invalid query parameters');
  }

  const raw = query as Record<string, unknown>;
  const errors: string[] = [];

  const pageRaw = parsePositiveInt(raw.page, 'page', errors);
  const limitRaw = parsePositiveInt(raw.limit, 'limit', errors);
  const minPrice = parsePositiveInt(raw.minPrice, 'minPrice', errors);
  const maxPrice = parsePositiveInt(raw.maxPrice, 'maxPrice', errors);

  if (pageRaw !== undefined && pageRaw < 1) {
    errors.push('page must be >= 1');
  }
  if (limitRaw !== undefined && (limitRaw < 1 || limitRaw > MAX_LIMIT)) {
    errors.push(`limit must be between 1 and ${MAX_LIMIT}`);
  }
  if (minPrice !== undefined && minPrice < 0) {
    errors.push('minPrice must be >= 0');
  }
  if (maxPrice !== undefined && maxPrice < 0) {
    errors.push('maxPrice must be >= 0');
  }
  if (
    minPrice !== undefined &&
    maxPrice !== undefined &&
    minPrice > maxPrice
  ) {
    errors.push('minPrice cannot be greater than maxPrice');
  }

  let search: string | undefined;
  if (raw.search !== undefined && raw.search !== '') {
    if (typeof raw.search !== 'string') {
      errors.push('search must be a string');
    } else {
      const trimmed = raw.search.trim();
      if (trimmed.length === 0) {
        search = undefined;
      } else if (trimmed.length > MAX_SEARCH_LENGTH) {
        errors.push(`search must be at most ${MAX_SEARCH_LENGTH} characters`);
      } else {
        search = trimmed;
      }
    }
  }

  let category: string | undefined;
  if (raw.category !== undefined && raw.category !== '') {
    if (typeof raw.category !== 'string') {
      errors.push('category must be a string');
    } else {
      category = raw.category.trim();
      if (category.length === 0) {
        category = undefined;
      }
    }
  }

  let sort: string = '-createdAt';
  if (raw.sort !== undefined && raw.sort !== '') {
    if (typeof raw.sort !== 'string') {
      errors.push('sort must be a string');
    } else if (
      !(PRODUCT_LIST_SORT_OPTIONS as readonly string[]).includes(raw.sort)
    ) {
      errors.push(
        `sort must be one of: ${PRODUCT_LIST_SORT_OPTIONS.join(', ')}`
      );
    } else {
      sort = raw.sort;
    }
  }

  // Public clients may send status, but storefront listing ignores non-active.
  // Reject unknown status values so callers get clear feedback.
  if (raw.status !== undefined && raw.status !== '') {
    if (typeof raw.status !== 'string') {
      errors.push('status must be a string');
    } else if (raw.status !== 'active') {
      errors.push(
        'Only active products are available on this endpoint; omit status or use active'
      );
    }
  }

  if (errors.length > 0) {
    throw new ApiError(400, 'Validation failed', errors);
  }

  const result: ProductListQuery = {
    page: pageRaw ?? DEFAULT_PAGE,
    limit: limitRaw ?? DEFAULT_LIMIT,
    sort,
  };

  if (search !== undefined) {
    result.search = search;
  }
  if (category !== undefined) {
    result.category = category;
  }
  if (minPrice !== undefined) {
    result.minPrice = minPrice;
  }
  if (maxPrice !== undefined) {
    result.maxPrice = maxPrice;
  }

  return result;
}

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SKU_REGEX = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;
const PRODUCT_STATUSES = ['draft', 'active', 'archived'] as const;

function parseNonNegInt(
  value: unknown,
  field: string,
  errors: string[]
): number | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }

  if (typeof value !== 'string' && typeof value !== 'number') {
    errors.push(`${field} must be an integer`);
    return undefined;
  }

  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    errors.push(`${field} must be a non-negative integer`);
    return undefined;
  }

  return parsed;
}

function parseOptionalString(
  value: unknown,
  field: string,
  errors: string[],
  options: { min?: number; max?: number; required?: boolean } = {}
): string | undefined {
  if (value === undefined || value === '') {
    if (options.required) {
      errors.push(`${field} is required`);
    }
    return undefined;
  }

  if (typeof value !== 'string') {
    errors.push(`${field} must be a string`);
    return undefined;
  }

  const trimmed = value.trim();
  if (options.min !== undefined && trimmed.length < options.min) {
    errors.push(`${field} must be at least ${options.min} characters`);
  }
  if (options.max !== undefined && trimmed.length > options.max) {
    errors.push(`${field} must be at most ${options.max} characters`);
  }

  return trimmed;
}

export function validateCreateProductInput(body: unknown): CreateProductInput {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'Invalid request body', [
      'Request body must be a JSON object',
    ]);
  }

  const raw = body as Record<string, unknown>;
  const errors: string[] = [];

  const name = parseOptionalString(raw.name, 'name', errors, {
    required: true,
    min: 2,
    max: 200,
  });

  let slug: string | undefined;
  if (raw.slug !== undefined && raw.slug !== '') {
    if (typeof raw.slug !== 'string') {
      errors.push('slug must be a string');
    } else {
      const normalized = slugify(raw.slug);
      if (!normalized || !SLUG_REGEX.test(normalized)) {
        errors.push('slug must be a valid kebab-case slug');
      } else {
        slug = normalized;
      }
    }
  }

  let description: string | undefined;
  if (raw.description !== undefined && raw.description !== '') {
    if (typeof raw.description !== 'string') {
      errors.push('description must be a string');
    } else if (raw.description.length > 10000) {
      errors.push('description must be at most 10000 characters');
    } else {
      description = raw.description.trim();
    }
  }

  const price = parseNonNegInt(raw.price, 'price', errors);
  if (raw.price === undefined || raw.price === '') {
    errors.push('price is required');
  }

  let compareAtPrice: number | null | undefined;
  if (raw.compareAtPrice === null) {
    compareAtPrice = null;
  } else if (raw.compareAtPrice !== undefined && raw.compareAtPrice !== '') {
    compareAtPrice = parseNonNegInt(raw.compareAtPrice, 'compareAtPrice', errors);
  }

  const skuRaw = parseOptionalString(raw.sku, 'sku', errors, {
    required: true,
    min: 1,
    max: 64,
  });
  let sku: string | undefined;
  if (skuRaw !== undefined) {
    if (!SKU_REGEX.test(skuRaw)) {
      errors.push('sku must be alphanumeric (dash/underscore allowed)');
    } else {
      sku = skuRaw.toUpperCase();
    }
  }

  const categoryId = parseOptionalString(raw.categoryId, 'categoryId', errors, {
    required: true,
  });
  if (categoryId !== undefined && !OBJECT_ID_REGEX.test(categoryId)) {
    errors.push('categoryId must be a valid ObjectId');
  }

  const stock = parseNonNegInt(raw.stock, 'stock', errors);

  let status: CreateProductInput['status'];
  if (raw.status !== undefined && raw.status !== '') {
    if (
      typeof raw.status !== 'string' ||
      !(PRODUCT_STATUSES as readonly string[]).includes(raw.status)
    ) {
      errors.push(`status must be one of: ${PRODUCT_STATUSES.join(', ')}`);
    } else {
      status = raw.status as CreateProductInput['status'];
    }
  }

  if (
    price !== undefined &&
    compareAtPrice !== undefined &&
    compareAtPrice !== null &&
    compareAtPrice <= price
  ) {
    errors.push('compareAtPrice must be greater than price');
  }

  if (errors.length > 0) {
    throw new ApiError(400, 'Validation failed', errors);
  }

  const result: CreateProductInput = {
    name: name as string,
    price: price as number,
    sku: sku as string,
    categoryId: categoryId as string,
  };

  if (slug !== undefined) {
    result.slug = slug;
  }
  if (description !== undefined) {
    result.description = description;
  }
  if (compareAtPrice !== undefined) {
    result.compareAtPrice = compareAtPrice;
  }
  if (stock !== undefined) {
    result.stock = stock;
  }
  if (status !== undefined) {
    result.status = status;
  }

  return result;
}

export function validateUpdateProductInput(body: unknown): UpdateProductInput {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'Invalid request body', [
      'Request body must be a JSON object',
    ]);
  }

  const raw = body as Record<string, unknown>;
  const errors: string[] = [];
  const result: UpdateProductInput = {};

  if (raw.name !== undefined) {
    const name = parseOptionalString(raw.name, 'name', errors, {
      min: 2,
      max: 200,
    });
    if (name !== undefined) {
      result.name = name;
    }
  }

  if (raw.slug !== undefined) {
    if (typeof raw.slug !== 'string') {
      errors.push('slug must be a string');
    } else {
      const normalized = slugify(raw.slug);
      if (!normalized || !SLUG_REGEX.test(normalized)) {
        errors.push('slug must be a valid kebab-case slug');
      } else {
        result.slug = normalized;
      }
    }
  }

  if (raw.description !== undefined) {
    if (raw.description === null) {
      result.description = null;
    } else if (typeof raw.description !== 'string') {
      errors.push('description must be a string');
    } else if (raw.description.length > 10000) {
      errors.push('description must be at most 10000 characters');
    } else {
      result.description = raw.description.trim();
    }
  }

  if (raw.price !== undefined) {
    const price = parseNonNegInt(raw.price, 'price', errors);
    if (price !== undefined) {
      result.price = price;
    }
  }

  if (raw.compareAtPrice !== undefined) {
    if (raw.compareAtPrice === null) {
      result.compareAtPrice = null;
    } else {
      const compareAtPrice = parseNonNegInt(
        raw.compareAtPrice,
        'compareAtPrice',
        errors
      );
      if (compareAtPrice !== undefined) {
        result.compareAtPrice = compareAtPrice;
      }
    }
  }

  if (raw.sku !== undefined) {
    const skuRaw = parseOptionalString(raw.sku, 'sku', errors, {
      min: 1,
      max: 64,
    });
    if (skuRaw !== undefined) {
      if (!SKU_REGEX.test(skuRaw)) {
        errors.push('sku must be alphanumeric (dash/underscore allowed)');
      } else {
        result.sku = skuRaw.toUpperCase();
      }
    }
  }

  if (raw.categoryId !== undefined) {
    const categoryId = parseOptionalString(raw.categoryId, 'categoryId', errors);
    if (categoryId !== undefined) {
      if (!OBJECT_ID_REGEX.test(categoryId)) {
        errors.push('categoryId must be a valid ObjectId');
      } else {
        result.categoryId = categoryId;
      }
    }
  }

  if (raw.stock !== undefined) {
    const stock = parseNonNegInt(raw.stock, 'stock', errors);
    if (stock !== undefined) {
      result.stock = stock;
    }
  }

  if (raw.status !== undefined) {
    if (
      typeof raw.status !== 'string' ||
      !(PRODUCT_STATUSES as readonly string[]).includes(raw.status)
    ) {
      errors.push(`status must be one of: ${PRODUCT_STATUSES.join(', ')}`);
    } else {
      result.status = raw.status as UpdateProductInput['status'];
    }
  }

  if (Object.keys(result).length === 0 && errors.length === 0) {
    errors.push('At least one field must be provided');
  }

  if (
    result.price !== undefined &&
    result.compareAtPrice !== undefined &&
    result.compareAtPrice !== null &&
    result.compareAtPrice <= result.price
  ) {
    errors.push('compareAtPrice must be greater than price');
  }

  if (errors.length > 0) {
    throw new ApiError(400, 'Validation failed', errors);
  }

  return result;
}

export function validateRemoveProductImageInput(body: unknown): {
  publicId: string;
} {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'Invalid request body', [
      'Request body must be a JSON object',
    ]);
  }

  const raw = body as Record<string, unknown>;
  if (typeof raw.publicId !== 'string' || raw.publicId.trim().length === 0) {
    throw new ApiError(400, 'Validation failed', ['publicId is required']);
  }

  if (raw.publicId.trim().length > 500) {
    throw new ApiError(400, 'Validation failed', [
      'publicId must be at most 500 characters',
    ]);
  }

  return { publicId: raw.publicId.trim() };
}
