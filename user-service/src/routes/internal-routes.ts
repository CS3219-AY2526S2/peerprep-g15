import { Router } from 'express';
import { InternalAuthController } from '../controllers/internal-auth-controller';
import { requireInternalService } from '../middleware/internal-auth-middleware';
import { validateBody } from '../middleware/validate';
import { resolveAuthSchema } from '../validation/internal-validation';

export const internalRouter = Router();

internalRouter.post(
    '/auth/resolve',
    requireInternalService,
    validateBody(resolveAuthSchema),
    InternalAuthController.resolve,
);
