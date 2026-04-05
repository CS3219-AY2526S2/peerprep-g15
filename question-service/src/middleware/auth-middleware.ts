import type { NextFunction, Request, Response } from 'express';
import type { Role, ResolvedUser } from '../utils/user';
import { AppError } from '../utils/app-error';
import { config } from '../config/env';

export interface AuthenticatedRequest extends Request {
    auth: {
        userId: string;
        role: Role;
        user: ResolvedUser;
    };
}

type ResolveAuthResponse = {
    user: ResolvedUser;
};

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
    try {
        const header = req.headers.authorization ?? '';
        const [scheme, token] = header.split(' ');

        if (scheme !== 'Bearer' || !token) {
            return next(AppError.unauthorized('Missing or invalid Authorization header'));
        }

        if (!config.userService.internalServiceToken) {
            return next(AppError.unauthorized('Internal service token is not configured'));
        }

        const response = await fetch(`${config.userService.baseUrl}/internal/auth/resolve`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Service-Token': config.userService.internalServiceToken,
            },
            body: JSON.stringify({
                accessToken: token,
            }),
        });

        let data: unknown = null;

        try {
            data = await response.json();
        } catch {
            data = null;
        }

        if (!response.ok || !data || typeof data !== 'object' || !('user' in data)) {
            const message =
                data &&
                typeof data === 'object' &&
                'message' in data &&
                typeof data.message === 'string'
                    ? data.message
                    : 'Invalid or expired token';

            return next(AppError.unauthorized(message));
        }

        const { user } = data as ResolveAuthResponse;

        (req as AuthenticatedRequest).auth = {
            userId: user.id,
            role: user.role,
            user,
        };

        return next();
    } catch {
        return next(AppError.unauthorized('Unable to resolve authentication with user service'));
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
