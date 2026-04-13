import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/app-error';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            error: {
                code: err.code,
                message: err.message,
                details: err.details,
            },
        });
    }

    const message = err instanceof Error ? err.message : 'Internal server error';
    return res.status(500).json({
        error: {
            code: 'INTERNAL_SERVER_ERROR',
            message,
        },
    });
}
