import type { Express } from 'express';
import { healthRouter } from './health-routes';
import { questionRouter } from './question-routes';

export function registerRoutes(app: Express) {
    app.use('/health', healthRouter);
    app.use('/questions', questionRouter);
}
