// routes/internal-question-routes.ts
import { Router } from 'express';
import { requireInternalAuth } from '../middleware/internal-auth';
import { getQuestionById, getQuestions } from '../controllers/question-controller';

export const internalQuestionRouter = Router();

internalQuestionRouter.use(requireInternalAuth);

internalQuestionRouter.get('/questions', requireInternalAuth, getQuestions);
internalQuestionRouter.get('/questions/:id', requireInternalAuth, getQuestionById);
