import { Router } from 'express';
import * as cartController from '../controllers/cart.controller';
import { authenticate } from '../middlewares/authenticate';
import { validateBody } from '../middlewares/validate';
import { validateAddCartItemInput } from '../validators/cart.validator';

const cartRouter = Router();

cartRouter.use(authenticate);

cartRouter.post(
  '/items',
  validateBody(validateAddCartItemInput),
  cartController.addItem
);

export default cartRouter;
