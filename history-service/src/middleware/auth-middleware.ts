import type { NextFunction, Request, Response } from 'express';
import { AuthResolutionError, resolveAuthUser } from '../services/auth-service';

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
            return res.status(err.status).json({ message: err.message });
        }

        return res.status(500).json({ message: 'Internal server error' });
    }
}

export function requireSelfOrAdmin(paramName = 'userId') {
    return (req: Request, res: Response, next: NextFunction) => {
        const auth = (req as AuthenticatedRequest).auth;

        if (!auth) {
            return res.status(401).json({ message: 'Missing or invalid token' });
        }

        const requestedUserId = req.params[paramName];
        if (auth.role !== 'admin' && auth.userId !== requestedUserId) {
            return res
                .status(403)
                .json({ message: 'Forbidden: cannot access another user history' });
        }

        return next();
    };
}

export function requireBodySelfOrAdmin(fieldName = 'userId') {
    return (req: Request, res: Response, next: NextFunction) => {
        const auth = (req as AuthenticatedRequest).auth;

        if (!auth) {
            return res.status(401).json({ message: 'Missing or invalid token' });
        }

        const requestedUserId =
            typeof req.body?.[fieldName] === 'string' ? req.body[fieldName].trim() : '';

        if (!requestedUserId) {
            return next();
        }

        if (auth.role !== 'admin' && auth.userId !== requestedUserId) {
            return res
                .status(403)
                .json({ message: 'Forbidden: cannot save attempt for another user' });
        }

        return next();
    };
}
