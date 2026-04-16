import type { NextFunction, Request, Response } from 'express';
import type { Role } from '../models/user-model';
import { UserModel } from '../models/user-model';
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
        const role = decoded.role;

        if (!userId) {
            return next(AppError.unauthorized('Invalid token payload'));
        }

        (req as AuthenticatedRequest).auth = { userId, role };
        return next();
    } catch {
        return next(AppError.unauthorized('Invalid or expired token'));
    }
}

// Does not log the user out, but ensures that stale admin privileges do not survive demotion and that the user cannot access them without the admin role.
export function requireRole(...allowedRoles: Role[]) {
    return async (req: Request, _res: Response, next: NextFunction) => {
        try {
            const auth = (req as AuthenticatedRequest).auth;

            if (!auth) {
                return next(AppError.unauthorized('Missing or invalid token'));
            }

            const user = await UserModel.findById(auth.userId).select('role');
            if (!user) {
                return next(AppError.unauthorized('User does not exist'));
            }

            if (!allowedRoles.includes(user.role)) {
                return next(AppError.forbidden('Insufficient permissions'));
            }

            auth.role = user.role;

            return next();
        } catch (err) {
            return next(err);
        }
    };
}
