import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response as ExpressResponse } from 'express';
import {
    requireAuth,
    requireRole,
    type AuthenticatedRequest,
} from '../../../middleware/auth-middleware';
import { AppError } from '../../../utils/app-error';
import { config } from '../../../config/env';

describe('auth-middleware', () => {
    const next = vi.fn() as NextFunction;
    const res = {} as ExpressResponse;

    beforeEach(() => {
        vi.clearAllMocks();
        config.userService.baseUrl = 'http://user-service';
        config.userService.internalServiceToken = 'internal-secret';
        vi.stubGlobal('fetch', vi.fn());
    });

    it('rejects missing Authorization header', async () => {
        const req = { headers: {} } as Request;

        await requireAuth(req, res, next);

        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 401,
                code: 'UNAUTHORIZED',
                message: 'Missing or invalid Authorization header',
            }),
        );
    });

    it('rejects malformed Authorization header', async () => {
        const req = {
            headers: { authorization: 'Token abc' },
        } as Request;

        await requireAuth(req, res, next);

        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 401,
                code: 'UNAUTHORIZED',
                message: 'Missing or invalid Authorization header',
            }),
        );
    });

    it('rejects when internal service token is not configured', async () => {
        config.userService.internalServiceToken = '';

        const req = {
            headers: { authorization: 'Bearer abc' },
        } as Request;

        await requireAuth(req, res, next);

        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 401,
                code: 'UNAUTHORIZED',
                message: 'Internal service token is not configured',
            }),
        );
    });

    it('rejects when auth resolution returns non-ok', async () => {
        const req = {
            headers: { authorization: 'Bearer abc' },
        } as Request;

        vi.mocked(fetch).mockResolvedValue({
            ok: false,
            json: vi.fn().mockResolvedValue({ message: 'Invalid token' }),
        } as unknown as any);

        await requireAuth(req, res, next);

        expect(fetch).toHaveBeenCalledWith(
            'http://user-service/internal/auth/resolve',
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    'Content-Type': 'application/json',
                    'X-Internal-Service-Token': 'internal-secret',
                }),
            }),
        );

        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 401,
                code: 'UNAUTHORIZED',
                message: 'Invalid token',
            }),
        );
    });

    it('rejects when response payload does not contain user', async () => {
        const req = {
            headers: { authorization: 'Bearer abc' },
        } as Request;

        vi.mocked(fetch).mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({ nope: true }),
        } as unknown as any);

        await requireAuth(req, res, next);

        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 401,
                code: 'UNAUTHORIZED',
                message: 'Invalid or expired token',
            }),
        );
    });

    it('rejects when fetch throws', async () => {
        const req = {
            headers: { authorization: 'Bearer abc' },
        } as Request;

        vi.mocked(fetch).mockRejectedValue(new Error('connect failed'));

        await requireAuth(req, res, next);

        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 401,
                code: 'UNAUTHORIZED',
                message: 'Unable to resolve authentication with user service',
            }),
        );
    });

    it('attaches auth and calls next on success', async () => {
        const req = {
            headers: { authorization: 'Bearer good-token' },
        } as AuthenticatedRequest;

        const resolvedUser = {
            id: 'u1',
            username: 'josh',
            displayName: 'Joshua',
            email: 'josh@example.com',
            role: 'admin' as const,
        };

        vi.mocked(fetch).mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({ user: resolvedUser }),
        } as unknown as any);

        await requireAuth(req, res, next);

        expect(req.auth).toEqual({
            userId: 'u1',
            role: 'admin',
            user: resolvedUser,
        });
        expect(next).toHaveBeenCalledWith();
    });

    it('requireRole rejects when auth is missing', () => {
        const req = {} as Request;
        const middleware = requireRole('admin');

        middleware(req, res, next);

        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 401,
                code: 'UNAUTHORIZED',
                message: 'Missing or invalid token',
            }),
        );
    });

    it('requireRole rejects disallowed role', () => {
        const req = {
            auth: {
                userId: 'u1',
                role: 'user',
                user: {
                    id: 'u1',
                    username: 'josh',
                    displayName: 'Joshua',
                    email: 'josh@example.com',
                    role: 'user',
                },
            },
        } as unknown as Request;

        const middleware = requireRole('admin');
        middleware(req, res, next);

        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 403,
                code: 'FORBIDDEN',
                message: 'Insufficient permissions',
            }),
        );
    });

    it('requireRole allows allowed role', () => {
        const req = {
            auth: {
                userId: 'u1',
                role: 'admin',
                user: {
                    id: 'u1',
                    username: 'josh',
                    displayName: 'Joshua',
                    email: 'josh@example.com',
                    role: 'admin',
                },
            },
        } as unknown as Request;

        const middleware = requireRole('admin');
        middleware(req, res, next);

        expect(next).toHaveBeenCalledWith();
    });
});
