import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { registerRoutes } from './routes';
import { notFoundHandler } from './middleware/notFound-middleware';
import { errorHandler } from './middleware/error-middleware';

export function createApp() {
    const app = express();

    app.use(
        helmet({
            crossOriginResourcePolicy: false,
        }),
    );

    app.use(
        cors({
            origin: ['http://localhost:5173', 'http://localhost:4173'],
            credentials: true,
        }),
    );

    app.use(express.json());
    app.use(cookieParser());
    registerRoutes(app);

    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}
