import type { Express } from 'express';
import { healthRouter } from './health-routes';
import { authRouter } from './auth-routes';

export function registerRoutes(app: Express) {
    app.use('/health', healthRouter);
    app.use('/api/auth', authRouter);
}
