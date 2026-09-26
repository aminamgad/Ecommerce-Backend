import { Schema, model, Document, Types } from 'mongoose';
import {
  ProductDetail,
  ProductImage,
  ProductListItem,
  ProductPublicDetail,
  ProductStatus,
} from '../types/product';

export interface IProductDocument extends Document {
  name: string;
  slug: string;
  description: string | null;
  price: number;
  compareAtPrice: number | null;
  sku: string;
  categoryId: Types.ObjectId;
  images: ProductImage[];
  stock: number;
  status: ProductStatus;
  createdAt: Date;
  updatedAt: Date;
  toListItem(): ProductListItem;
  toPublicDetail(): ProductPublicDetail;
  toDetail(): ProductDetail;
}

const productImageSchema = new Schema<ProductImage>(
  {
    publicId: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    alt: { type: String, trim: true, maxlength: 200 },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: false }
);

const productSchema = new Schema<IProductDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 200,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 220,
    },
    description: {
      type: String,
      default: null,
      maxlength: 10000,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    compareAtPrice: {
      type: Number,
      default: null,
      min: 0,
    },
    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 64,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    images: {
      type: [productImageSchema],
      default: [],
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'archived'],
      required: true,
      default: 'draft',
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'products',
  }
);

productSchema.index({ status: 1, categoryId: 1, createdAt: -1 });
productSchema.index({ status: 1, price: 1 });
productSchema.index({ status: 1, createdAt: -1 });
productSchema.index({ name: 'text', description: 'text' });

productSchema.methods.toListItem = function toListItem(): ProductListItem {
  const images = this.images ?? [];
  const sorted = [...images].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  );
  const first = sorted[0];

  return {
    id: (this._id as Types.ObjectId).toString(),
    name: this.name,
    slug: this.slug,
    price: this.price,
    compareAtPrice: this.compareAtPrice ?? null,
    categoryId: this.categoryId.toString(),
    thumbnail: first
      ? {
          url: first.url,
          ...(first.alt !== undefined ? { alt: first.alt } : {}),
        }
      : null,
    inStock: this.stock > 0,
    status: this.status,
    createdAt: this.createdAt,
  };
};

productSchema.methods.toPublicDetail = function toPublicDetail(): ProductPublicDetail {
  return {
    id: (this._id as Types.ObjectId).toString(),
    name: this.name,
    slug: this.slug,
    description: this.description ?? null,
    price: this.price,
    compareAtPrice: this.compareAtPrice ?? null,
    categoryId: this.categoryId.toString(),
    images: (this.images ?? []).map((img: ProductImage) => ({
      url: img.url,
      ...(img.alt !== undefined ? { alt: img.alt } : {}),
      ...(img.sortOrder !== undefined ? { sortOrder: img.sortOrder } : {}),
    })),
    inStock: this.stock > 0,
    status: this.status,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

productSchema.methods.toDetail = function toDetail(): ProductDetail {
  return {
    id: (this._id as Types.ObjectId).toString(),
    name: this.name,
    slug: this.slug,
    description: this.description ?? null,
    price: this.price,
    compareAtPrice: this.compareAtPrice ?? null,
    sku: this.sku,
    categoryId: this.categoryId.toString(),
    images: (this.images ?? []).map((img: ProductImage) => ({
      publicId: img.publicId,
      url: img.url,
      ...(img.alt !== undefined ? { alt: img.alt } : {}),
      ...(img.sortOrder !== undefined ? { sortOrder: img.sortOrder } : {}),
    })),
    stock: this.stock,
    status: this.status,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const Product = model<IProductDocument>('Product', productSchema);
