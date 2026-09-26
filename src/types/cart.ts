export type AddCartItemInput = {
  productId: string;
  quantity: number;
};

export type CartItemView = {
  productId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  name: string;
  slug: string;
  thumbnailUrl: string | null;
  stock: number;
};

export type CartView = {
  id: string;
  items: CartItemView[];
  itemCount: number;
  itemsSubtotal: number;
};

/** Hard cap per line (also constrained by product stock). */
export const MAX_CART_LINE_QUANTITY = 99;
