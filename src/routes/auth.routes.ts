import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middlewares/authenticate';
import { validateBody } from '../middlewares/validate';
import {
  validateLoginInput,
  validateRegisterInput,
} from '../validators/auth.validator';

const authRouter = Router();

authRouter.post(
  '/register',
  validateBody(validateRegisterInput),
  authController.register
);

authRouter.post(
  '/login',
  validateBody(validateLoginInput),
  authController.login
);

authRouter.get('/me', authenticate, authController.me);

export default authRouter;
