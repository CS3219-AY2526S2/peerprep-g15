import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/app-error';

type MongoDuplicateKeyError = Error & {
    code?: number;
    keyPattern?: Record<string, number>;
    keyValue?: Record<string, unknown>;
};

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

    const mongoErr = err as MongoDuplicateKeyError;

    // To catch race conditions where two users try to register with the same username+email combination at the same time
    if (mongoErr?.code === 11000) {
        const duplicatedFields = Object.keys(mongoErr.keyPattern ?? {});
        const duplicatedField = duplicatedFields[0];

        let message = 'Resource already exists';
        if (duplicatedField === 'username') message = 'Username already in use';
        if (duplicatedField === 'email') message = 'Email already in use';

        return res.status(409).json({
            error: {
                code: 'CONFLICT',
                message,
                ...(duplicatedField ? { details: { field: duplicatedField } } : {}),
            },
        });
    }

    const isProd = process.env.NODE_ENV === 'production';

    return res.status(500).json({
        error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: isProd
                ? 'An unexpected error occurred'
                : err instanceof Error
                  ? err.message
                  : 'Internal Server Error',
        },
    });
}
