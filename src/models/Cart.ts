import { Schema, model, Document, Types } from 'mongoose';

export type CartItem = {
  productId: Types.ObjectId;
  quantity: number;
};

export interface ICartDocument extends Document {
  userId: Types.ObjectId;
  items: CartItem[];
  createdAt: Date;
  updatedAt: Date;
}

const cartItemSchema = new Schema<CartItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      max: 99,
    },
  },
  { _id: false }
);

const cartSchema = new Schema<ICartDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    items: {
      type: [cartItemSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'carts',
  }
);

cartSchema.index({ userId: 1 }, { unique: true });
cartSchema.index({ userId: 1, 'items.productId': 1 });

export const Cart = model<ICartDocument>('Cart', cartSchema);
