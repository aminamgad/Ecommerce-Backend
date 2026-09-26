import { Types } from 'mongoose';
import { Cart, ICartDocument } from '../models/Cart';
import { Category } from '../models/Category';
import { Product, IProductDocument } from '../models/Product';
import { ApiError } from '../utils/ApiError';
import { assertStrictObjectId } from '../utils/objectId';
import {
  AddCartItemInput,
  CartItemView,
  CartView,
  MAX_CART_LINE_QUANTITY,
} from '../types/cart';

async function loadSellableProduct(
  productId: string
): Promise<IProductDocument> {
  assertStrictObjectId(productId, 'Invalid product id');

  const product = await Product.findById(productId).exec();
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  if (product.status !== 'active') {
    throw new ApiError(400, 'Product is not available', [
      'Inactive or non-sellable products cannot be added to the cart',
    ]);
  }

  const category = await Category.findById(product.categoryId)
    .select('isActive')
    .exec();

  if (!category || !category.isActive) {
    throw new ApiError(400, 'Product is not available', [
      'Product category is inactive',
    ]);
  }

  if (product.stock <= 0) {
    throw new ApiError(400, 'Product is out of stock');
  }

  return product;
}

function assertQuantityWithinLimits(
  quantity: number,
  stock: number,
  context: 'add' | 'merge'
): void {
  if (quantity < 1) {
    throw new ApiError(400, 'Validation failed', [
      'quantity must be greater than 0',
    ]);
  }

  if (quantity > MAX_CART_LINE_QUANTITY) {
    throw new ApiError(400, 'Validation failed', [
      `quantity cannot exceed ${MAX_CART_LINE_QUANTITY} per cart line`,
    ]);
  }

  if (quantity > stock) {
    throw new ApiError(400, 'Insufficient stock', [
      context === 'merge'
        ? `Requested total quantity exceeds available stock (${stock})`
        : `Requested quantity exceeds available stock (${stock})`,
    ]);
  }
}

async function getOrCreateCart(userId: string): Promise<ICartDocument> {
  const existing = await Cart.findOne({ userId }).exec();
  if (existing) {
    return existing;
  }

  try {
    return await Cart.create({
      userId: new Types.ObjectId(userId),
      items: [],
    });
  } catch (error) {
    // Concurrent first-add: unique userId — reload the winner.
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: unknown }).code === 11000
    ) {
      const cart = await Cart.findOne({ userId }).exec();
      if (cart) {
        return cart;
      }
    }
    throw error;
  }
}

async function toCartView(cart: ICartDocument): Promise<CartView> {
  const productIds = cart.items.map((item) => item.productId);
  const products = await Product.find({ _id: { $in: productIds } })
    .select('name slug price images stock status categoryId')
    .exec();

  const productMap = new Map(
    products.map((p) => [(p._id as Types.ObjectId).toString(), p])
  );

  const items: CartItemView[] = [];
  let itemsSubtotal = 0;
  let itemCount = 0;

  for (const item of cart.items) {
    const product = productMap.get(item.productId.toString());
    if (!product || product.status !== 'active') {
      // Stale lines are omitted from purchasable totals on this response.
      continue;
    }

    const images = product.images ?? [];
    const sorted = [...images].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    );
    const thumb = sorted[0];
    const unitPrice = product.price;
    const lineTotal = unitPrice * item.quantity;

    items.push({
      productId: item.productId.toString(),
      quantity: item.quantity,
      unitPrice,
      lineTotal,
      name: product.name,
      slug: product.slug,
      thumbnailUrl: thumb?.url ?? null,
      stock: product.stock,
    });

    itemsSubtotal += lineTotal;
    itemCount += item.quantity;
  }

  return {
    id: (cart._id as Types.ObjectId).toString(),
    items,
    itemCount,
    itemsSubtotal,
  };
}

/**
 * Add a product to the authenticated user's cart.
 * Merges quantity when the product is already in the cart.
 */
export async function addCartItem(
  userId: string,
  input: AddCartItemInput
): Promise<CartView> {
  const product = await loadSellableProduct(input.productId);

  assertQuantityWithinLimits(input.quantity, product.stock, 'add');

  const cart = await getOrCreateCart(userId);
  const productObjectId = product._id as Types.ObjectId;

  const existing = cart.items.find((item) =>
    item.productId.equals(productObjectId)
  );

  if (existing) {
    const mergedQuantity = existing.quantity + input.quantity;
    assertQuantityWithinLimits(mergedQuantity, product.stock, 'merge');
    existing.quantity = mergedQuantity;
  } else {
    cart.items.push({
      productId: productObjectId,
      quantity: input.quantity,
    });
  }

  await cart.save();
  return toCartView(cart);
}
