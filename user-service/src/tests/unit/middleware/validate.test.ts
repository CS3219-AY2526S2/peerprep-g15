import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import {
    validateBody,
    validateQuery,
    type ValidatedQueryRequest,
} from '../../../middleware/validate';

describe('validateBody', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: NextFunction;

    beforeEach(() => {
        req = { body: {} };
        res = {};
        next = vi.fn();
    });

    it('parses a valid request body and calls next()', () => {
        const schema = z.object({
            username: z.string().trim().min(1),
        });

        req.body = { username: 'alice123' };

        validateBody(schema)(req as Request, res as Response, next);

        expect(req.body).toEqual({ username: 'alice123' });
        expect(next).toHaveBeenCalledWith();
    });

    it('passes AppError.badRequest for invalid request body', () => {
        const schema = z.object({
            username: z.string().min(3),
        });

        req.body = { username: 'ab' };

        validateBody(schema)(req as Request, res as Response, next);

        expect(next).toHaveBeenCalled();
        const err = vi.mocked(next).mock.calls[0][0] as {
            statusCode?: number;
            code?: string;
            message?: string;
        };

        expect(err.statusCode).toBe(400);
        expect(err.code).toBe('BAD_REQUEST');
        expect(err.message).toBe('Invalid request body');
    });
});

describe('validateQuery', () => {
    let req: Partial<ValidatedQueryRequest>;
    let res: Partial<Response>;
    let next: NextFunction;

    beforeEach(() => {
        req = { query: {} };
        res = {};
        next = vi.fn();
    });

    it('parses a valid request query and stores validatedQuery', () => {
        const schema = z.object({
            page: z.coerce.number().int().min(1).default(1),
            limit: z.coerce.number().int().min(1).max(50).default(10),
        });

        req.query = { page: '2', limit: '5' };

        validateQuery(schema)(req as Request, res as Response, next);

        expect(req.validatedQuery).toEqual({ page: 2, limit: 5 });
        expect(next).toHaveBeenCalledWith();
    });

    it('passes AppError.badRequest for invalid query parameters', () => {
        const schema = z.object({
            role: z.enum(['user', 'admin']),
        });

        req.query = { role: 'superadmin' };

        validateQuery(schema)(req as Request, res as Response, next);

        expect(next).toHaveBeenCalled();
        const err = vi.mocked(next).mock.calls[0][0] as {
            statusCode?: number;
            code?: string;
            message?: string;
        };

        expect(err.statusCode).toBe(400);
        expect(err.code).toBe('BAD_REQUEST');
        expect(err.message).toBe('Invalid query parameters');
    });
});
