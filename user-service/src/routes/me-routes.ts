import { Router } from 'express';
import { requireAuth } from '../middleware/auth-middleware';
import { validateBody } from '../middleware/validate';
import { updateMeSchema } from '../validation/me-validation';
import { MeController } from '../controllers/me-controller';

export const meRouter = Router();

meRouter.get('/', requireAuth, MeController.me);
meRouter.patch('/', requireAuth, validateBody(updateMeSchema), MeController.update);
