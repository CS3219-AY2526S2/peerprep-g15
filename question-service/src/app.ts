import express from 'express';
import { registerRoutes } from './routes';
import { notFoundHandler } from './middleware/notFound-middleware';
import { errorHandler } from './middleware/error-middleware';

export function createApp() {
    const app = express();

    app.use(express.json());

    registerRoutes(app);

    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}
