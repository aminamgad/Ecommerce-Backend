import { Schema, model, Document, Types } from 'mongoose';
import { CategoryImage, CategoryResponse } from '../types/category';

export interface ICategory {
  name: string;
  nameNormalized: string;
  slug: string;
  description: string | null;
  image: CategoryImage | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICategoryDocument extends Document {
  name: string;
  nameNormalized: string;
  slug: string;
  description: string | null;
  image: CategoryImage | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  toSafeObject(): CategoryResponse;
}

const categoryImageSchema = new Schema<CategoryImage>(
  {
    publicId: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    alt: { type: String, trim: true, maxlength: 200 },
  },
  { _id: false }
);

const categorySchema = new Schema<ICategoryDocument>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name must be at most 100 characters'],
    },
    nameNormalized: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: [120, 'Slug must be at most 120 characters'],
    },
    description: {
      type: String,
      default: null,
      trim: true,
      maxlength: [2000, 'Description must be at most 2000 characters'],
    },
    image: {
      type: categoryImageSchema,
      default: null,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
    sortOrder: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'categories',
  }
);

categorySchema.index({ isActive: 1, sortOrder: 1 });

categorySchema.methods.toSafeObject = function toSafeObject(): CategoryResponse {
  return {
    id: (this._id as Types.ObjectId).toString(),
    name: this.name,
    slug: this.slug,
    description: this.description ?? null,
    image: this.image
      ? {
          publicId: this.image.publicId,
          url: this.image.url,
          ...(this.image.alt !== undefined ? { alt: this.image.alt } : {}),
        }
      : null,
    isActive: this.isActive,
    sortOrder: this.sortOrder,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

categorySchema.set('toJSON', {
  transform(_doc, ret) {
    const safe = { ...(ret as unknown as Record<string, unknown>) };
    safe.id = (safe._id as { toString(): string })?.toString?.() ?? safe._id;
    delete safe._id;
    delete safe.nameNormalized;
    return safe;
  },
});

export const Category = model<ICategoryDocument>('Category', categorySchema);
