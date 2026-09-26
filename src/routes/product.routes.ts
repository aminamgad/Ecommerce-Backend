import { Router } from 'express';
import * as productController from '../controllers/product.controller';
import { authenticate } from '../middlewares/authenticate';
import { requireAdmin } from '../middlewares/authorize';
import { uploadProductImage } from '../middlewares/upload';
import { validateBody, validateQuery } from '../middlewares/validate';
import {
  validateCreateProductInput,
  validateProductListQuery,
  validateRemoveProductImageInput,
  validateUpdateProductInput,
} from '../validators/product.validator';

const productRouter = Router();

/** Public storefront */
productRouter.get(
  '/',
  validateQuery(validateProductListQuery),
  productController.list
);
productRouter.get('/:slug', productController.getBySlug);

export const adminProductRouter = Router();

adminProductRouter.use(authenticate, requireAdmin);

adminProductRouter.get('/', productController.listAdmin);
adminProductRouter.get('/:id', productController.getAdminById);
adminProductRouter.post(
  '/',
  validateBody(validateCreateProductInput),
  productController.create
);
adminProductRouter.patch(
  '/:id',
  validateBody(validateUpdateProductInput),
  productController.update
);
adminProductRouter.delete('/:id', productController.remove);

adminProductRouter.post(
  '/:id/images',
  uploadProductImage,
  productController.uploadImage
);

adminProductRouter.delete(
  '/:id/images',
  validateBody(validateRemoveProductImageInput),
  productController.removeImage
);

export default productRouter;
