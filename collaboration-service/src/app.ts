import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/error-handler';
import { registerRoutes } from './routes/index';

export function createApp() {
    const app = express();

    app.use(cors());
    app.use(express.json());

    registerRoutes(app);

    app.use(errorHandler);

    return app;
}
