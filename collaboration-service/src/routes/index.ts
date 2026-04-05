import type { Express } from 'express';
import collaborationRouter from './collaboration-routes';

export function registerRoutes(app: Express) {
    app.use('/session', collaborationRouter);
}
