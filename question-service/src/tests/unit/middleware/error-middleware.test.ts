import { describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
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

    it('returns 400 for mongoose validation errors', () => {
        const err = new mongoose.Error.ValidationError();
        err.message = 'Validation failed';

        const req = {} as Request;
        const res = createMockRes();
        const next = vi.fn() as NextFunction;

        errorHandler(err, req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Validation failed',
            },
        });
    });

    it('returns 409 for mongoose version errors', () => {
        const err = new mongoose.Error.VersionError(
            { _doc: { _id: 'abc123', title: 'Two Sum' } } as never,
            3,
            [],
        );

        const req = {} as Request;
        const res = createMockRes();
        const next = vi.fn() as NextFunction;

        errorHandler(err, req, res, next);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith({
            error: {
                code: 'VERSION_CONFLICT',
                message: 'Question was modified by another admin. Refresh and try again.',
            },
        });
    });

    it('returns 409 for duplicate key errors', () => {
        const req = {} as Request;
        const res = createMockRes();
        const next = vi.fn() as NextFunction;

        errorHandler({ code: 11000 }, req, res, next);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith({
            error: {
                code: 'DUPLICATE_QUESTION',
                message: 'Duplicate question detected',
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
