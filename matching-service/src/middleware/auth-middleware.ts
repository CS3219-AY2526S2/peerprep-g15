import type { NextFunction, Request, Response } from 'express';
import { AuthResolutionError, resolveAuthUser } from '../services/auth-service.js';

export interface AuthenticatedRequest extends Request {
    auth: {
        userId: string;
        role: 'user' | 'admin';
    };
}

function getBearerToken(header: string | undefined) {
    if (!header) {
        return null;
    }

    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
        return null;
    }

    return token;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
    const token = getBearerToken(req.headers.authorization);
    if (!token) {
        return res.status(401).json({ message: 'Missing or invalid Authorization header' });
    }

    try {
        const user = await resolveAuthUser(token);

        (req as AuthenticatedRequest).auth = {
            userId: user.id,
            role: user.role,
        };

        return next();
    } catch (err) {
        if (err instanceof AuthResolutionError) {
            const resolutionError = err as AuthResolutionError;
            return res.status(resolutionError.status).json({ message: resolutionError.message });
        }

        return res.status(500).json({ message: 'Internal server error' });
    }
}
