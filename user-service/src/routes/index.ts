import type { Express } from 'express';
import { healthRouter } from './health-routes';
import { authRouter } from './auth-routes';
import { homeRouter } from './home-routes';
import { adminRouter } from './admin-routes';
import { meRouter } from './me-routes';

export function registerRoutes(app: Express) {
    app.use('/health', healthRouter);
    app.use('/auth', authRouter);
    app.use('/home', homeRouter);
    app.use('/admin', adminRouter);
    app.use('/me', meRouter);
}
