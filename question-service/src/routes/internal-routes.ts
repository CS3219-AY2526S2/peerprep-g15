import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { Question } from '../models/question-model';
import { config } from '../config/env';

export const internalRouter = Router();

function requireInternalToken(req: Request, res: Response, next: NextFunction) {
    const token = req.headers['x-internal-service-token'];
    if (
        !config.userService.internalServiceToken ||
        token !== config.userService.internalServiceToken
    ) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    next();
}

internalRouter.get('/questions/:id', requireInternalToken, async (req, res, next) => {
    try {
        const questionId = Number(req.params.id);
        if (Number.isNaN(questionId)) {
            res.status(400).json({ message: 'Invalid question id' });
            return;
        }
        const question = await Question.findOne({ questionId });
        if (!question) {
            res.status(404).json({ message: 'Question not found' });
            return;
        }
        res.status(200).json(question);
    } catch (err) {
        next(err);
    }
});
