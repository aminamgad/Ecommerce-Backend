import { Router } from 'express';
import authRouter from './auth.routes';
import cartRouter from './cart.routes';
import categoryRouter, { adminCategoryRouter } from './category.routes';
import productRouter, { adminProductRouter } from './product.routes';

const router = Router();

router.use('/auth', authRouter);
router.use('/v1/cart', cartRouter);
router.use('/categories', categoryRouter);
router.use('/admin/categories', adminCategoryRouter);
router.use('/v1/products', productRouter);
router.use('/admin/products', adminProductRouter);

export default router;
