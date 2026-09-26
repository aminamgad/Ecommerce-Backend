import { FilterQuery, Types } from 'mongoose';
import { Category } from '../models/Category';
import { Product, IProductDocument } from '../models/Product';
import { ApiError } from '../utils/ApiError';
import { slugify } from '../utils/slugify';
import { assertStrictObjectId, isStrictObjectId } from '../utils/objectId';
import {
  CreateProductInput,
  ProductDetail,
  ProductListQuery,
  ProductListResult,
  ProductPublicDetail,
  ProductStatus,
  UpdateProductInput,
} from '../types/product';
import { deleteImage, uploadImageBuffer } from '../integrations/cloudinary/storage';

const SORT_MAP: Record<string, Record<string, 1 | -1>> = {
  price: { price: 1 },
  '-price': { price: -1 },
  createdAt: { createdAt: 1 },
  '-createdAt': { createdAt: -1 },
  name: { name: 1 },
  '-name': { name: -1 },
};

const MAX_IMAGES = 10;

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

function resolveSlug(name: string, explicitSlug?: string): string {
  const slug = explicitSlug && explicitSlug.length > 0 ? explicitSlug : slugify(name);
  if (!slug) {
    throw new ApiError(400, 'Validation failed', [
      'Unable to generate slug from name; provide an explicit slug',
    ]);
  }
  return slug;
}

async function assertActiveCategory(categoryId: string): Promise<Types.ObjectId> {
  assertStrictObjectId(categoryId, 'Invalid category id');

  const category = await Category.findById(categoryId).select('isActive').exec();
  if (!category || !category.isActive) {
    throw new ApiError(400, 'Category not found or inactive');
  }

  return category._id as Types.ObjectId;
}

function assertPublishable(
  status: ProductStatus,
  price: number,
  imageCount: number
): void {
  if (status !== 'active') {
    return;
  }
  if (price <= 0) {
    throw new ApiError(400, 'Validation failed', [
      'Active products must have price greater than 0',
    ]);
  }
  if (imageCount < 1) {
    throw new ApiError(400, 'Validation failed', [
      'Active products must have at least one image',
    ]);
  }
}

/**
 * Resolve category filter: prefer slug when not a strict ObjectId,
 * so hex-like slugs are not misread as ids.
 */
async function resolveCategoryFilter(
  categoryParam: string
): Promise<Types.ObjectId> {
  if (!isStrictObjectId(categoryParam)) {
    const slug = slugify(categoryParam);
    if (!slug) {
      throw new ApiError(400, 'Invalid category filter');
    }

    const bySlug = await Category.findOne({ slug, isActive: true })
      .select('_id')
      .exec();

    if (!bySlug) {
      throw new ApiError(404, 'Category not found');
    }

    return bySlug._id as Types.ObjectId;
  }

  const byId = await Category.findById(categoryParam)
    .select('_id isActive')
    .exec();

  if (!byId || !byId.isActive) {
    throw new ApiError(404, 'Category not found');
  }

  return byId._id as Types.ObjectId;
}

function buildSort(sort: string): Record<string, 1 | -1> {
  return SORT_MAP[sort] ?? { createdAt: -1 };
}

export async function listProducts(
  query: ProductListQuery
): Promise<ProductListResult> {
  const activeCategories = await Category.find({ isActive: true })
    .select('_id')
    .exec();
  const activeCategoryIds = activeCategories.map((c) => c._id);

  const filter: FilterQuery<IProductDocument> = {
    status: 'active',
    categoryId: { $in: activeCategoryIds },
  };

  if (query.category) {
    filter.categoryId = await resolveCategoryFilter(query.category);
  }

  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filter.price = {};
    if (query.minPrice !== undefined) {
      filter.price.$gte = query.minPrice;
    }
    if (query.maxPrice !== undefined) {
      filter.price.$lte = query.maxPrice;
    }
  }

  if (query.search) {
    // Treat the whole input as a phrase to avoid client text-operators.
    filter.$text = { $search: `"${query.search.replace(/"/g, '')}"` };
  }

  const sort = buildSort(query.sort);
  const skip = (query.page - 1) * query.limit;

  const [products, total] = await Promise.all([
    Product.find(filter)
      .select(
        'name slug price compareAtPrice categoryId images stock status createdAt'
      )
      .sort(sort)
      .skip(skip)
      .limit(query.limit)
      .exec(),
    Product.countDocuments(filter).exec(),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / query.limit);

  return {
    items: products.map((product) => product.toListItem()),
    page: query.page,
    limit: query.limit,
    total,
    totalPages,
  };
}

export async function getActiveProductBySlug(
  slug: string
): Promise<ProductPublicDetail> {
  const normalized = slugify(slug);
  if (!normalized) {
    throw new ApiError(400, 'Invalid product slug');
  }

  const product = await Product.findOne({
    slug: normalized,
    status: 'active',
  }).exec();

  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  const category = await Category.findById(product.categoryId)
    .select('isActive')
    .exec();
  if (!category || !category.isActive) {
    throw new ApiError(404, 'Product not found');
  }

  return product.toPublicDetail();
}

export async function getProductByIdForAdmin(
  id: string
): Promise<ProductDetail> {
  assertStrictObjectId(id, 'Invalid product id');

  const product = await Product.findById(id).exec();
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  return product.toDetail();
}

export async function listProductsForAdmin(): Promise<ProductDetail[]> {
  const products = await Product.find().sort({ createdAt: -1 }).limit(200).exec();
  return products.map((p) => p.toDetail());
}

export async function createProduct(
  input: CreateProductInput
): Promise<ProductDetail> {
  const categoryId = await assertActiveCategory(input.categoryId);
  const slug = resolveSlug(input.name, input.slug);
  const status: ProductStatus = input.status ?? 'draft';
  const stock = input.stock ?? 0;
  const compareAtPrice =
    input.compareAtPrice === undefined ? null : input.compareAtPrice;

  if (compareAtPrice !== null && compareAtPrice <= input.price) {
    throw new ApiError(400, 'Validation failed', [
      'compareAtPrice must be greater than price',
    ]);
  }

  assertPublishable(status, input.price, 0);

  try {
    const product = await Product.create({
      name: input.name,
      slug,
      description: input.description ?? null,
      price: input.price,
      compareAtPrice,
      sku: input.sku.toUpperCase(),
      categoryId,
      stock,
      status,
      images: [],
    });

    return product.toDetail();
  } catch (error) {
    if (isDuplicateKeyError(error, 'slug')) {
      throw new ApiError(409, 'Product slug is already in use');
    }
    if (isDuplicateKeyError(error, 'sku')) {
      throw new ApiError(409, 'Product SKU is already in use');
    }
    throw error;
  }
}

export async function updateProduct(
  id: string,
  input: UpdateProductInput
): Promise<ProductDetail> {
  assertStrictObjectId(id, 'Invalid product id');

  const product = await Product.findById(id).exec();
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  if (input.name !== undefined) {
    product.name = input.name;
  }
  if (input.slug !== undefined) {
    product.slug = resolveSlug(product.name, input.slug);
  }
  if (input.description !== undefined) {
    product.description = input.description;
  }
  if (input.price !== undefined) {
    product.price = input.price;
  }
  if (input.compareAtPrice !== undefined) {
    product.compareAtPrice = input.compareAtPrice;
  }
  if (input.sku !== undefined) {
    product.sku = input.sku.toUpperCase();
  }
  if (input.categoryId !== undefined) {
    product.categoryId = await assertActiveCategory(input.categoryId);
  }
  if (input.stock !== undefined) {
    product.stock = input.stock;
  }
  if (input.status !== undefined) {
    product.status = input.status;
  }

  const compareAt = product.compareAtPrice;
  if (compareAt !== null && compareAt <= product.price) {
    throw new ApiError(400, 'Validation failed', [
      'compareAtPrice must be greater than price',
    ]);
  }

  assertPublishable(
    product.status,
    product.price,
    product.images?.length ?? 0
  );

  try {
    await product.save();
    return product.toDetail();
  } catch (error) {
    if (isDuplicateKeyError(error, 'slug')) {
      throw new ApiError(409, 'Product slug is already in use');
    }
    if (isDuplicateKeyError(error, 'sku')) {
      throw new ApiError(409, 'Product SKU is already in use');
    }
    throw error;
  }
}

export async function archiveProduct(id: string): Promise<ProductDetail> {
  assertStrictObjectId(id, 'Invalid product id');

  const product = await Product.findById(id).exec();
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  product.status = 'archived';
  await product.save();
  return product.toDetail();
}

export async function addProductImage(
  productId: string,
  file: { buffer: Buffer; mimetype: string },
  alt?: string
): Promise<ProductDetail> {
  assertStrictObjectId(productId, 'Invalid product id');

  const product = await Product.findById(productId).exec();
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  if ((product.images?.length ?? 0) >= MAX_IMAGES) {
    throw new ApiError(400, `Product cannot have more than ${MAX_IMAGES} images`);
  }

  let uploadedPublicId: string | undefined;

  try {
    const uploaded = await uploadImageBuffer(file.buffer, {
      folder: `products/${productId}`,
      mimeType: file.mimetype,
    });
    uploadedPublicId = uploaded.publicId;

    product.images.push({
      publicId: uploaded.publicId,
      url: uploaded.url,
      ...(alt ? { alt } : {}),
      sortOrder: product.images.length,
    });

    await product.save();
    return product.toDetail();
  } catch (error) {
    if (uploadedPublicId) {
      try {
        await deleteImage(uploadedPublicId);
      } catch {
        console.error('Failed to compensate Cloudinary upload', uploadedPublicId);
      }
    }
    throw error;
  }
}

export async function removeProductImage(
  productId: string,
  publicId: string
): Promise<ProductDetail> {
  assertStrictObjectId(productId, 'Invalid product id');

  const product = await Product.findById(productId).exec();
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  const exists = product.images.some((img) => img.publicId === publicId);
  if (!exists) {
    throw new ApiError(404, 'Image not found on product');
  }

  if (product.status === 'active' && product.images.length <= 1) {
    throw new ApiError(400, 'Validation failed', [
      'Cannot remove the last image from an active product',
    ]);
  }

  product.images = product.images.filter((img) => img.publicId !== publicId);
  await product.save();

  try {
    await deleteImage(publicId);
  } catch (error) {
    console.error('Cloudinary delete failed after DB update', publicId, error);
  }

  return product.toDetail();
}
