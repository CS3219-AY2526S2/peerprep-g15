import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import {
    requireAuth,
    requireRole,
    type AuthenticatedRequest,
} from '../../../middleware/auth-middleware';

vi.mock('../../../utils/jwt', () => ({
    verifyAccessToken: vi.fn(),
}));

vi.mock('../../../models/user-model', () => ({
    UserModel: {
        findById: vi.fn(),
    },
}));

import { verifyAccessToken } from '../../../utils/jwt';
import { UserModel } from '../../../models/user-model';

describe('requireAuth', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: NextFunction;

    beforeEach(() => {
        vi.clearAllMocks();
        req = {
            headers: {},
        };
        res = {};
        next = vi.fn();
    });

    it('passes unauthorized error when Authorization header is missing', () => {
        requireAuth(req as Request, res as Response, next);

        expect(next).toHaveBeenCalled();
        const err = vi.mocked(next).mock.calls[0][0] as {
            statusCode?: number;
            code?: string;
        };

        expect(err.statusCode).toBe(401);
        expect(err.code).toBe('UNAUTHORIZED');
    });

    it('passes unauthorized error when Authorization scheme is not Bearer', () => {
        req.headers = {
            authorization: 'Basic abc123',
        };

        requireAuth(req as Request, res as Response, next);

        expect(next).toHaveBeenCalled();
        const err = vi.mocked(next).mock.calls[0][0] as {
            statusCode?: number;
            code?: string;
        };

        expect(err.statusCode).toBe(401);
        expect(err.code).toBe('UNAUTHORIZED');
    });

    it('passes unauthorized error when token verification fails', () => {
        req.headers = {
            authorization: 'Bearer bad-token',
        };

        vi.mocked(verifyAccessToken).mockImplementation(() => {
            throw new Error('bad token');
        });

        requireAuth(req as Request, res as Response, next);

        expect(next).toHaveBeenCalled();
        const err = vi.mocked(next).mock.calls[0][0] as {
            statusCode?: number;
            code?: string;
        };

        expect(err.statusCode).toBe(401);
        expect(err.code).toBe('UNAUTHORIZED');
    });

    it('passes unauthorized error when token payload has no sub', () => {
        req.headers = {
            authorization: 'Bearer valid-token',
        };

        vi.mocked(verifyAccessToken).mockReturnValue({
            sub: '',
            role: 'user',
            type: 'access',
        });

        requireAuth(req as Request, res as Response, next);

        expect(next).toHaveBeenCalled();
        const err = vi.mocked(next).mock.calls[0][0] as {
            statusCode?: number;
            code?: string;
        };

        expect(err.statusCode).toBe(401);
        expect(err.code).toBe('UNAUTHORIZED');
    });

    it('attaches auth info and calls next() for a valid token', () => {
        req.headers = {
            authorization: 'Bearer valid-token',
        };

        vi.mocked(verifyAccessToken).mockReturnValue({
            sub: 'user-123',
            role: 'admin',
            type: 'access',
        });

        requireAuth(req as Request, res as Response, next);

        expect((req as AuthenticatedRequest).auth).toEqual({
            userId: 'user-123',
            role: 'admin',
        });
        expect(next).toHaveBeenCalledWith();
    });
});

describe('requireRole', () => {
    let req: Partial<AuthenticatedRequest>;
    let res: Partial<Response>;
    let next: NextFunction;

    beforeEach(() => {
        vi.clearAllMocks();
        req = {};
        res = {};
        next = vi.fn();
    });

    it('passes unauthorized error when req.auth is missing', async () => {
        const middleware = requireRole('admin');

        await middleware(req as Request, res as Response, next);

        expect(next).toHaveBeenCalled();
        const err = vi.mocked(next).mock.calls[0][0] as {
            statusCode?: number;
            code?: string;
        };

        expect(err.statusCode).toBe(401);
        expect(err.code).toBe('UNAUTHORIZED');
    });

    it('passes unauthorized error when current user no longer exists', async () => {
        req.auth = {
            userId: 'user-123',
            role: 'admin',
        };

        vi.mocked(UserModel.findById).mockReturnValue({
            select: vi.fn().mockResolvedValue(null),
        } as any);

        const middleware = requireRole('admin');
        await middleware(req as Request, res as Response, next);

        expect(next).toHaveBeenCalled();
        const err = vi.mocked(next).mock.calls[0][0] as {
            statusCode?: number;
            code?: string;
        };

        expect(err.statusCode).toBe(401);
        expect(err.code).toBe('UNAUTHORIZED');
    });

    it('passes forbidden error when current DB role is not allowed', async () => {
        req.auth = {
            userId: 'user-123',
            role: 'admin', // stale token role
        };

        vi.mocked(UserModel.findById).mockReturnValue({
            select: vi.fn().mockResolvedValue({ role: 'user' }),
        } as any);

        const middleware = requireRole('admin');
        await middleware(req as Request, res as Response, next);

        expect(next).toHaveBeenCalled();
        const err = vi.mocked(next).mock.calls[0][0] as {
            statusCode?: number;
            code?: string;
        };

        expect(err.statusCode).toBe(403);
        expect(err.code).toBe('FORBIDDEN');
    });

    it('allows request when current DB role is permitted', async () => {
        req.auth = {
            userId: 'user-123',
            role: 'user',
        };

        vi.mocked(UserModel.findById).mockReturnValue({
            select: vi.fn().mockResolvedValue({ role: 'admin' }),
        } as any);

        const middleware = requireRole('admin');
        await middleware(req as Request, res as Response, next);

        expect(req.auth?.role).toBe('admin');
        expect(next).toHaveBeenCalledWith();
    });

    it('allows request when DB role matches one of multiple allowed roles', async () => {
        req.auth = {
            userId: 'user-123',
            role: 'user',
        };

        vi.mocked(UserModel.findById).mockReturnValue({
            select: vi.fn().mockResolvedValue({ role: 'user' }),
        } as any);

        const middleware = requireRole('user', 'admin');
        await middleware(req as Request, res as Response, next);

        expect(req.auth?.role).toBe('user');
        expect(next).toHaveBeenCalledWith();
    });
});
