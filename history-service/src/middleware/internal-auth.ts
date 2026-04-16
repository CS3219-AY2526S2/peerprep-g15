import type { NextFunction, Request, Response } from 'express';
import { config } from '../config/env';

export function requireInternalAuth(req: Request, res: Response, next: NextFunction) {
    if (!config.internal.serviceToken) {
        return res.status(500).json({ message: 'Internal service token is not configured' });
    }

    const providedToken = req.header('x-internal-service-token');
    if (!providedToken || providedToken !== config.internal.serviceToken) {
        return res.status(403).json({ message: 'Forbidden' });
    }

    return next();
}
