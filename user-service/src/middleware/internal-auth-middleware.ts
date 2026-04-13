import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/app-error';
import { config } from '../config/env';

export function requireInternalService(req: Request, _res: Response, next: NextFunction) {
    const provided = req.header('X-Internal-Service-Token');
    const expected = config.internal.serviceToken;

    if (!expected) {
        return next(AppError.unauthorized('Internal service token is not configured'));
    }

    if (!provided || provided !== expected) {
        return next(AppError.forbidden('Invalid internal service token'));
    }

    return next();
}
