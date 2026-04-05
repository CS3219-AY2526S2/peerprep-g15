import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { notFoundHandler } from '../../middleware/notFound-middleware';

describe('notFoundHandler', () => {
    let req: Request;
    let res: Response;
    let statusMock: ReturnType<typeof vi.fn>;
    let jsonMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        req = {} as Request;

        jsonMock = vi.fn();
        statusMock = vi.fn().mockReturnValue({
            json: jsonMock,
        });

        res = {
            status: statusMock,
        } as unknown as Response;
    });

    it('returns 404 with route not found error body', () => {
        notFoundHandler(req, res);

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
            error: {
                code: 'NOT_FOUND',
                message: 'Route not found',
            },
        });
    });
});
