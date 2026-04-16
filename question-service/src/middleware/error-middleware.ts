import mongoose from 'mongoose';
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

    if (err instanceof mongoose.Error.ValidationError) {
        return res.status(400).json({
            error: {
                code: 'VALIDATION_ERROR',
                message: err.message,
            },
        });
    }

    if (err instanceof mongoose.Error.VersionError) {
        return res.status(409).json({
            error: {
                code: 'VERSION_CONFLICT',
                message: 'Question was modified by another admin. Refresh and try again.',
            },
        });
    }

    if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code?: number }).code === 11000
    ) {
        return res.status(409).json({
            error: {
                code: 'DUPLICATE_QUESTION',
                message: 'Duplicate question detected',
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
