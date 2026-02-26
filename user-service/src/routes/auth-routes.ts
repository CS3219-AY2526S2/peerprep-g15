import { Router } from 'express';
import { AuthController } from '../controllers/auth-controller';
import { requireAuth } from '../middleware/auth-middleware';
import { validateBody } from '../middleware/validate';
import { registerSchema, loginSchema } from '../validation/auth-validation';

export const authRouter = Router();

authRouter.post('/register', validateBody(registerSchema), AuthController.register);
authRouter.post('/login', validateBody(loginSchema), AuthController.login);
authRouter.post('/logout', requireAuth, AuthController.logout);
