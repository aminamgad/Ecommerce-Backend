export type ProductStatus = 'draft' | 'active' | 'archived';

export type ProductImage = {
  publicId: string;
  url: string;
  alt?: string;
  sortOrder?: number;
};

/** Public list card — no Cloudinary publicId, no exact stock. */
export type ProductListItem = {
  id: string;
  name: string;
  slug: string;
  price: number;
  compareAtPrice: number | null;
  categoryId: string;
  thumbnail: { url: string; alt?: string } | null;
  inStock: boolean;
  status: ProductStatus;
  createdAt: Date;
};

/** Storefront product detail — no Cloudinary publicId, no exact stock. */
export type ProductPublicDetail = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  compareAtPrice: number | null;
  categoryId: string;
  images: Array<{ url: string; alt?: string; sortOrder?: number }>;
  inStock: boolean;
  status: ProductStatus;
  createdAt: Date;
  updatedAt: Date;
};

/** Admin product detail — includes SKU, stock, and Cloudinary publicIds. */
export type ProductDetail = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  compareAtPrice: number | null;
  sku: string;
  categoryId: string;
  images: ProductImage[];
  stock: number;
  status: ProductStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type ProductListQuery = {
  page: number;
  limit: number;
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sort: string;
};

export type ProductListResult = {
  items: ProductListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type CreateProductInput = {
  name: string;
  slug?: string;
  description?: string;
  price: number;
  compareAtPrice?: number | null;
  sku: string;
  categoryId: string;
  stock?: number;
  status?: ProductStatus;
};

export type UpdateProductInput = {
  name?: string;
  slug?: string;
  description?: string | null;
  price?: number;
  compareAtPrice?: number | null;
  sku?: string;
  categoryId?: string;
  stock?: number;
  status?: ProductStatus;
};
