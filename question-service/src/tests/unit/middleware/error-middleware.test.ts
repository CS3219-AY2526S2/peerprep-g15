import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { errorHandler } from '../../../middleware/error-middleware';
import { AppError } from '../../../utils/app-error';

function createMockRes() {
    return {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
    } as unknown as Response;
}

describe('errorHandler', () => {
    it('returns AppError status, code, message, and details', () => {
        const err = AppError.badRequest('Invalid payload', { field: 'title' });
        const req = {} as Request;
        const res = createMockRes();
        const next = vi.fn() as NextFunction;

        errorHandler(err, req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            error: {
                code: 'BAD_REQUEST',
                message: 'Invalid payload',
                details: { field: 'title' },
            },
        });
    });

    it('returns 500 for normal Error', () => {
        const req = {} as Request;
        const res = createMockRes();
        const next = vi.fn() as NextFunction;

        errorHandler(new Error('Boom'), req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Boom',
            },
        });
    });

    it('returns fallback 500 for non-Error values', () => {
        const req = {} as Request;
        const res = createMockRes();
        const next = vi.fn() as NextFunction;

        errorHandler('bad' as unknown, req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Internal server error',
            },
        });
    });
});
