import type { Express } from 'express';
import { healthRouter } from './health-routes';
import { questionRouter } from './question-routes';
import { internalQuestionRouter } from './internal-question-routes';
import cors from 'cors';

const corsMiddleware = cors({
    origin: ['http://localhost:5173', 'http://localhost:4173'],
    credentials: true,
});

export function registerRoutes(app: Express) {
    app.use('/health', corsMiddleware, healthRouter);
    app.use('/questions', corsMiddleware, questionRouter);
    app.use('/internal', internalQuestionRouter);
}
