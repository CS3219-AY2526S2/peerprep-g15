import express from 'express';
import cookieParser from 'cookie-parser';
import { registerRoutes } from './routes';
import { notFoundHandler } from './middleware/notFound-middleware';
import { errorHandler } from './middleware/error-middleware';

export function createApp() {
    const app = express();

    app.use(express.json());
    app.use(cookieParser());
    registerRoutes(app);

    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}
