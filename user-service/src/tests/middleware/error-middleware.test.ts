import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { errorHandler } from '../../middleware/error-middleware';
import { AppError } from '../../utils/app-error';

describe('errorHandler', () => {
    let req: Request;
    let res: Response;
    let next: NextFunction;
    let statusMock: ReturnType<typeof vi.fn>;
    let jsonMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        req = {} as Request;
        next = vi.fn();

        jsonMock = vi.fn();
        statusMock = vi.fn().mockReturnValue({
            json: jsonMock,
        });

        res = {
            status: statusMock,
        } as unknown as Response;

        vi.unstubAllEnvs();
    });

    it('returns AppError status, code, and message', () => {
        const err = AppError.forbidden('Insufficient permissions');

        errorHandler(err, req as Request, res as Response, next);

        expect(statusMock).toHaveBeenCalledWith(403);
        expect(jsonMock).toHaveBeenCalledWith({
            error: {
                code: 'FORBIDDEN',
                message: 'Insufficient permissions',
            },
        });
    });

    it('includes AppError details when present', () => {
        const err = AppError.badRequest('Invalid request body', {
            fieldErrors: { username: ['Required'] },
        });

        errorHandler(err, req as Request, res as Response, next);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
            error: {
                code: 'BAD_REQUEST',
                message: 'Invalid request body',
                details: {
                    fieldErrors: { username: ['Required'] },
                },
            },
        });
    });

    it('returns 409 for duplicate username', () => {
        const err = {
            code: 11000,
            keyPattern: { username: 1 },
        };

        errorHandler(err, req as Request, res as Response, next);

        expect(statusMock).toHaveBeenCalledWith(409);
        expect(jsonMock).toHaveBeenCalledWith({
            error: {
                code: 'CONFLICT',
                message: 'Username already in use',
                details: { field: 'username' },
            },
        });
    });

    it('returns 409 for duplicate email', () => {
        const err = {
            code: 11000,
            keyPattern: { email: 1 },
        };

        errorHandler(err, req as Request, res as Response, next);

        expect(statusMock).toHaveBeenCalledWith(409);
        expect(jsonMock).toHaveBeenCalledWith({
            error: {
                code: 'CONFLICT',
                message: 'Email already in use',
                details: { field: 'email' },
            },
        });
    });

    it('returns generic duplicate-resource message for unknown duplicate field', () => {
        const err = {
            code: 11000,
            keyPattern: { someOtherField: 1 },
        };

        errorHandler(err, req as Request, res as Response, next);

        expect(statusMock).toHaveBeenCalledWith(409);
        expect(jsonMock).toHaveBeenCalledWith({
            error: {
                code: 'CONFLICT',
                message: 'Resource already exists',
                details: { field: 'someOtherField' },
            },
        });
    });

    it('returns actual error message in development', () => {
        vi.stubEnv('NODE_ENV', 'development');

        const err = new Error('Something went wrong');

        errorHandler(err, req as Request, res as Response, next);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Something went wrong',
            },
        });
    });

    it('returns generic message in production', () => {
        vi.stubEnv('NODE_ENV', 'production');

        const err = new Error('Sensitive internal error');

        errorHandler(err, req as Request, res as Response, next);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'An unexpected error occurred',
            },
        });
    });

    it('returns fallback internal server error for non-Error values', () => {
        vi.stubEnv('NODE_ENV', 'development');

        errorHandler('plain string error', req as Request, res as Response, next);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Internal Server Error',
            },
        });
    });
});
