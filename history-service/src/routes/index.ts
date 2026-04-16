import type { Express } from 'express';
import attemptRoutes from './attempt-routes';

export function registerRoutes(app: Express) {
    app.use('/', attemptRoutes);
}
