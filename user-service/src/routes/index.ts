import type { Express } from 'express';
import { healthRouter } from './health-routes';
import { authRouter } from './auth-routes';
import { homeRouter } from './home-routes';
import { adminRouter } from './admin-routes';

export function registerRoutes(app: Express) {
    app.use('/health', healthRouter);
    app.use('/api/auth', authRouter);
    app.use('/api/home', homeRouter);
    app.use('/admin', adminRouter);
}
