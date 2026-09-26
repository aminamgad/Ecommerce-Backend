import { Schema, model, Document, Types } from 'mongoose';
import { SafeUser, UserRole } from '../types/auth';

export interface IUser {
  name: string;
  email: string;
  /** bcrypt hash only — never plain text */
  password: string;
  role: UserRole;
  isActive: boolean;
  tokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserDocument extends Document {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  isActive: boolean;
  tokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
  toSafeObject(): SafeUser;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userSchema = new Schema<IUserDocument>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name must be at most 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [255, 'Email must be at most 255 characters'],
      validate: {
        validator(value: string) {
          return EMAIL_REGEX.test(value);
        },
        message: 'Email must be a valid email address',
      },
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: ['customer', 'admin'],
        message: 'Role must be customer or admin',
      },
      required: [true, 'Role is required'],
      default: 'customer',
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
    tokenVersion: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'users',
  }
);

userSchema.index({ role: 1, isActive: 1 });

userSchema.methods.toSafeObject = function toSafeObject(): SafeUser {
  return {
    id: (this._id as Types.ObjectId).toString(),
    name: this.name,
    email: this.email,
    role: this.role,
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

function stripPassword(
  _doc: unknown,
  ret: Record<string, unknown>
): Record<string, unknown> {
  const safe = { ...ret };
  safe.id = (safe._id as { toString(): string })?.toString?.() ?? safe._id;
  delete safe._id;
  delete safe.password;
  return safe;
}

userSchema.set('toJSON', {
  transform(doc, ret) {
    return stripPassword(doc, ret as unknown as Record<string, unknown>);
  },
});

userSchema.set('toObject', {
  transform(doc, ret) {
    return stripPassword(doc, ret as unknown as Record<string, unknown>);
  },
});

export const User = model<IUserDocument>('User', userSchema);
