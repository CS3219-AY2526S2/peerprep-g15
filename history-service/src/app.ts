import cors from 'cors';
import express from 'express';
import { registerRoutes } from './routes';
import { errorHandler } from './middleware/error-handler';

export function createApp() {
    const app = express();

    app.use(
        cors({
            origin: ['http://localhost:5173', 'http://localhost:4173'], // Allow frontend on this origin
            credentials: true, // Allow cookies (if using refresh tokens)
        }),
    );

    app.use(express.json());

    app.get('/health', (_req, res) => {
        res.status(200).json({
            status: 'ok',
            service: 'history-service',
        });
    });

    registerRoutes(app);

    app.use(errorHandler);

    return app;
}
