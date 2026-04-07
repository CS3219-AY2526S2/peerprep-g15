import type { Express } from 'express';
import collaborationRouter from './collaboration-routes';
import { healthRouter } from './health-routes';

export function registerRoutes(app: Express) {
    app.use('/collab', collaborationRouter);
    app.use('/health', healthRouter);
}
