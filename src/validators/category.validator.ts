import { ApiError } from '../utils/ApiError';
import {
  CategoryImage,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '../types/category';
import { slugify } from '../utils/slugify';

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function parseOptionalImage(
  value: unknown,
  fieldName: string
): CategoryImage | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    throw new ApiError(400, 'Validation failed', [
      `${fieldName} cannot be null on create; omit the field instead`,
    ]);
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, 'Validation failed', [
      `${fieldName} must be an object`,
    ]);
  }

  const image = value as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof image.publicId !== 'string' || image.publicId.trim().length === 0) {
    errors.push(`${fieldName}.publicId is required`);
  }
  if (typeof image.url !== 'string' || image.url.trim().length === 0) {
    errors.push(`${fieldName}.url is required`);
  }
  if (
    image.alt !== undefined &&
    (typeof image.alt !== 'string' || image.alt.length > 200)
  ) {
    errors.push(`${fieldName}.alt must be a string of at most 200 characters`);
  }

  if (errors.length > 0) {
    throw new ApiError(400, 'Validation failed', errors);
  }

  return {
    publicId: (image.publicId as string).trim(),
    url: (image.url as string).trim(),
    ...(typeof image.alt === 'string' ? { alt: image.alt.trim() } : {}),
  };
}

function parseOptionalImageUpdate(
  value: unknown,
  fieldName: string
): CategoryImage | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return parseOptionalImage(value, fieldName);
}

export function validateCreateCategoryInput(body: unknown): CreateCategoryInput {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'Invalid request body', [
      'Request body must be a JSON object',
    ]);
  }

  const raw = body as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof raw.name !== 'string') {
    errors.push('Name is required');
  } else if (raw.name.trim().length < 2) {
    errors.push('Name must be at least 2 characters');
  } else if (raw.name.trim().length > 100) {
    errors.push('Name must be at most 100 characters');
  }

  if (raw.slug !== undefined) {
    if (typeof raw.slug !== 'string' || raw.slug.trim().length === 0) {
      errors.push('Slug must be a non-empty string');
    } else {
      const normalized = slugify(raw.slug);
      if (!normalized || !SLUG_REGEX.test(normalized)) {
        errors.push('Slug must be a valid URL-safe kebab-case value');
      }
    }
  }

  if (raw.description !== undefined && raw.description !== null) {
    if (typeof raw.description !== 'string') {
      errors.push('Description must be a string');
    } else if (raw.description.trim().length > 2000) {
      errors.push('Description must be at most 2000 characters');
    }
  }

  if (raw.isActive !== undefined && typeof raw.isActive !== 'boolean') {
    errors.push('isActive must be a boolean');
  }

  if (raw.sortOrder !== undefined) {
    if (typeof raw.sortOrder !== 'number' || !Number.isInteger(raw.sortOrder)) {
      errors.push('sortOrder must be an integer');
    }
  }

  if (errors.length > 0) {
    throw new ApiError(400, 'Validation failed', errors);
  }

  const image = parseOptionalImage(raw.image, 'image');

  const input: CreateCategoryInput = {
    name: (raw.name as string).trim(),
  };

  if (typeof raw.slug === 'string') {
    input.slug = slugify(raw.slug);
  }
  if (typeof raw.description === 'string') {
    input.description = raw.description.trim();
  }
  if (image) {
    input.image = image;
  }
  if (typeof raw.isActive === 'boolean') {
    input.isActive = raw.isActive;
  }
  if (typeof raw.sortOrder === 'number') {
    input.sortOrder = raw.sortOrder;
  }

  return input;
}

export function validateUpdateCategoryInput(body: unknown): UpdateCategoryInput {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'Invalid request body', [
      'Request body must be a JSON object',
    ]);
  }

  const raw = body as Record<string, unknown>;
  const errors: string[] = [];
  const hasAnyField =
    raw.name !== undefined ||
    raw.slug !== undefined ||
    raw.description !== undefined ||
    raw.image !== undefined ||
    raw.isActive !== undefined ||
    raw.sortOrder !== undefined;

  if (!hasAnyField) {
    throw new ApiError(400, 'Validation failed', [
      'At least one field is required to update',
    ]);
  }

  if (raw.name !== undefined) {
    if (typeof raw.name !== 'string') {
      errors.push('Name must be a string');
    } else if (raw.name.trim().length < 2) {
      errors.push('Name must be at least 2 characters');
    } else if (raw.name.trim().length > 100) {
      errors.push('Name must be at most 100 characters');
    }
  }

  if (raw.slug !== undefined) {
    if (typeof raw.slug !== 'string' || raw.slug.trim().length === 0) {
      errors.push('Slug must be a non-empty string');
    } else {
      const normalized = slugify(raw.slug);
      if (!normalized || !SLUG_REGEX.test(normalized)) {
        errors.push('Slug must be a valid URL-safe kebab-case value');
      }
    }
  }

  if (raw.description !== undefined && raw.description !== null) {
    if (typeof raw.description !== 'string') {
      errors.push('Description must be a string');
    } else if (raw.description.trim().length > 2000) {
      errors.push('Description must be at most 2000 characters');
    }
  }

  if (raw.isActive !== undefined && typeof raw.isActive !== 'boolean') {
    errors.push('isActive must be a boolean');
  }

  if (raw.sortOrder !== undefined) {
    if (typeof raw.sortOrder !== 'number' || !Number.isInteger(raw.sortOrder)) {
      errors.push('sortOrder must be an integer');
    }
  }

  if (errors.length > 0) {
    throw new ApiError(400, 'Validation failed', errors);
  }

  const input: UpdateCategoryInput = {};

  if (typeof raw.name === 'string') {
    input.name = raw.name.trim();
  }
  if (typeof raw.slug === 'string') {
    input.slug = slugify(raw.slug);
  }
  if (raw.description === null) {
    input.description = null;
  } else if (typeof raw.description === 'string') {
    input.description = raw.description.trim();
  }

  const image = parseOptionalImageUpdate(raw.image, 'image');
  if (image !== undefined) {
    input.image = image;
  }
  if (typeof raw.isActive === 'boolean') {
    input.isActive = raw.isActive;
  }
  if (typeof raw.sortOrder === 'number') {
    input.sortOrder = raw.sortOrder;
  }

  return input;
}
