import type { NextFunction, Request, Response } from 'express';
import type { Role } from '../models/user-model';
import { AppError } from '../utils/app-error';
import { verifyAccessToken } from '../utils/jwt';

export interface AuthenticatedRequest extends Request {
    auth: {
        userId: string;
        role: Role;
    };
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
    try {
        const header = req.headers.authorization ?? '';
        const [scheme, token] = header.split(' ');

        if (scheme !== 'Bearer' || !token) {
            return next(AppError.unauthorized('Missing or invalid Authorization header'));
        }

        const decoded = verifyAccessToken(token);

        const userId = decoded.sub;
        const role = decoded.role as Role;

        if (!userId) {
            return next(AppError.unauthorized('Invalid token payload'));
        }

        (req as AuthenticatedRequest).auth = { userId, role };
        return next();
    } catch {
        return next(AppError.unauthorized('Invalid or expired token'));
    }
}

export function requireRole(...allowedRoles: Role[]) {
    return (req: Request, _res: Response, next: NextFunction) => {
        const auth = (req as AuthenticatedRequest).auth;

        if (!auth) return next(AppError.unauthorized('Missing or invalid token'));

        if (!allowedRoles.includes(auth.role)) {
            return next(AppError.forbidden('Insufficient permissions'));
        }

        return next();
    };
}
