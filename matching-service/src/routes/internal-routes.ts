import { MatchingController } from '../controllers/matching-controller';
import { requireInternalAuth } from '../middleware/internal-auth';
import { Router } from 'express';

export const internalSessionRouter = Router();

internalSessionRouter.post('/sessions', requireInternalAuth, MatchingController.end);
