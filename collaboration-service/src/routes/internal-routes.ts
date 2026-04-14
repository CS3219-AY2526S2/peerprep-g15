// routes/internal-question-routes.ts
import { Router } from 'express';
import { createSessionHandler } from '../controllers/collaboration-controllers';
import { requireInternalAuth } from '../middleware/internal-auth';

export const internalSessionRouter = Router();

internalSessionRouter.post('/sessions', requireInternalAuth, createSessionHandler);
