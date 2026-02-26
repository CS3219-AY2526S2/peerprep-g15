import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/app-error';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            error: {
                code: err.code,
                message: err.message,
                ...(err.details ? { details: err.details } : {}),
            },
        });
    }

    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return res.status(500).json({
        error: { code: 'INTERNAL_SERVER_ERROR', message },
    });
}
