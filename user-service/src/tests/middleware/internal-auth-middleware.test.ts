import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requireInternalService } from '../../middleware/internal-auth-middleware';

vi.mock('../../config/env', () => ({
    config: {
        internal: {
            serviceToken: 'test-internal-secret',
        },
    },
}));

describe('requireInternalService', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: NextFunction;

    beforeEach(() => {
        req = {
            header: vi.fn(),
        };
        res = {};
        next = vi.fn();
    });

    it('calls next() when the correct internal service token is provided', () => {
        vi.mocked(req.header as any).mockReturnValue('test-internal-secret');

        requireInternalService(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledWith();
    });

    it('passes forbidden error when token is missing', () => {
        vi.mocked(req.header as any).mockReturnValue(undefined);

        requireInternalService(req as Request, res as Response, next);

        expect(next).toHaveBeenCalled();
        const err = vi.mocked(next).mock.calls[0][0] as { statusCode?: number; code?: string };
        expect(err.statusCode).toBe(403);
        expect(err.code).toBe('FORBIDDEN');
    });

    it('passes forbidden error when token is incorrect', () => {
        vi.mocked(req.header as any).mockReturnValue('wrong-secret');

        requireInternalService(req as Request, res as Response, next);

        expect(next).toHaveBeenCalled();
        const err = vi.mocked(next).mock.calls[0][0] as { statusCode?: number; code?: string };
        expect(err.statusCode).toBe(403);
        expect(err.code).toBe('FORBIDDEN');
    });
});
