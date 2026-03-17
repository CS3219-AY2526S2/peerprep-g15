import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth-middleware';
import {
    getQuestions,
    getQuestionById,
    createQuestion,
    updateQuestion,
    deleteQuestion,
} from '../controllers/question-controller';

export const questionRouter = Router();

questionRouter.get('/', requireAuth, getQuestions);
questionRouter.get('/:id', requireAuth, getQuestionById);

questionRouter.post('/', requireAuth, requireRole('admin'), createQuestion);
questionRouter.put('/:id', requireAuth, requireRole('admin'), updateQuestion);
questionRouter.delete('/:id', requireAuth, requireRole('admin'), deleteQuestion);
