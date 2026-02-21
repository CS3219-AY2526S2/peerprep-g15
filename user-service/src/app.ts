import express from 'express';
import { registerRoutes } from './routes';
import { notFoundHandler } from './middleware/notFound-middleware';
import { errorHandler } from './middleware/error-middleware';

export function createApp() {
    const app = express();

    // Base middleware
    app.use(express.json());

    // Routes
    registerRoutes(app);

    // 404 + error handlers (always last)
    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}
