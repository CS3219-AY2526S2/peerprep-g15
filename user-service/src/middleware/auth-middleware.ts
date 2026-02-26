import type { NextFunction, Request, Response } from 'express';
import jwt, { type JwtPayload, type Secret } from 'jsonwebtoken';
import type { Role } from '../models/user-model';
import { AppError } from '../utils/app-error';

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

        const secret = process.env.JWT_SECRET as Secret;
        if (!secret) {
            return next(new Error('JWT_SECRET is missing')); // Server misconfiguration, not a client error
        }

        const decoded = jwt.verify(token, secret) as JwtPayload;

        const userId = decoded.sub;
        const role = (decoded as any).role as Role;

        if (!userId) {
            return next(AppError.unauthorized('Invalid token payload'));
        }

        (req as any).auth = { userId, role };
        return next();
    } catch {
        return next(AppError.unauthorized('Invalid or expired token'));
    }
}

export function requireRole(...allowedRoles: Role[]) {
    return (req: Request, _res: Response, next: NextFunction) => {
        const auth = (req as any).auth as { userId: string; role: Role } | undefined;

        if (!auth) return next(AppError.unauthorized('Missing or invalid token'));

        if (!allowedRoles.includes(auth.role)) {
            return next(AppError.forbidden('Insufficient permissions'));
        }

        return next();
    };
}
