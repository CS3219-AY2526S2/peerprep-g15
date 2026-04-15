import type { Express } from 'express';
import matchingRouter from './matching-routes';
import { internalSessionRouter } from './internal-routes';

export function registerRoutes(app: Express) {
    app.use('/matching', matchingRouter);
    app.use('/internal', internalSessionRouter);
}
