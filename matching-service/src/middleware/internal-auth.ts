// middleware/internal-auth.ts
import { Request, Response, NextFunction } from 'express';

export const requireInternalAuth = (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers['x-internal-service-token'];
    if (apiKey !== process.env.INTERNAL_SERVICE_TOKEN) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    next();
};
