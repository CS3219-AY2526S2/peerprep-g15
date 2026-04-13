import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { notFoundHandler } from '../../../middleware/notFound-middleware';

function createMockRes() {
    const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
    } as unknown as Response;

    return res;
}

describe('notFoundHandler', () => {
    it('returns 404 with the expected error body', () => {
        const req = {} as Request;
        const res = createMockRes();

        notFoundHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            error: {
                code: 'NOT_FOUND',
                message: 'Route not found',
            },
        });
    });
});
