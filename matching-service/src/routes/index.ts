import type { Express } from 'express';
import matchingRouter from './matching-routes';

export function registerRoutes(app: Express) {
    app.use('/matching', matchingRouter);
}
