import express from 'express';
import cookieParser from 'cookie-parser';
import { registerRoutes } from './routes';
import { notFoundHandler } from './middleware/notFound-middleware';
import { errorHandler } from './middleware/error-middleware';
import cors from 'cors';

export function createApp() {
    const app = express();
    app.use(cors({ origin: 'http://localhost:5173', credentials: true }));

    app.use(express.json());
    app.use(cookieParser());
    registerRoutes(app);

    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}
