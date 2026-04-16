import express from 'express';
import cors from 'cors';
import { registerRoutes } from './routes/index';
import { notFoundHandler } from './middleware/notFound-middleware';
import { errorHandler } from './middleware/error-middleware';

export function createApp() {
    const app = express();

    app.use(
        cors({
            origin: ['http://localhost:5173', 'http://localhost:4173'], // Allow frontend on this origin
            credentials: true, // Allow cookies (if using refresh tokens)
        }),
    );

    app.use(express.json());

    registerRoutes(app);

    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}
