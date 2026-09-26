import { Router } from 'express';
import * as categoryController from '../controllers/category.controller';
import { authenticate } from '../middlewares/authenticate';
import { requireAdmin } from '../middlewares/authorize';
import { validateBody } from '../middlewares/validate';
import {
  validateCreateCategoryInput,
  validateUpdateCategoryInput,
} from '../validators/category.validator';

const categoryRouter = Router();

/** Public: active categories only */
categoryRouter.get('/', categoryController.listPublic);
categoryRouter.get('/:slug', categoryController.getPublicBySlug);

export const adminCategoryRouter = Router();

adminCategoryRouter.use(authenticate, requireAdmin);

adminCategoryRouter.get('/', categoryController.listAdmin);
adminCategoryRouter.get('/:id', categoryController.getAdminById);
adminCategoryRouter.post(
  '/',
  validateBody(validateCreateCategoryInput),
  categoryController.create
);
adminCategoryRouter.patch(
  '/:id',
  validateBody(validateUpdateCategoryInput),
  categoryController.update
);
adminCategoryRouter.delete('/:id', categoryController.remove);

export default categoryRouter;
