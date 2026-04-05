import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { NextFunction, Request, Response } from 'express';

vi.mock('../../middleware/auth-middleware', () => ({
    requireAuth: vi.fn((req: Request, _res: Response, next: NextFunction) => {
        (
            req as Request & {
                auth?: { userId: string; role: 'admin' | 'user' };
            }
        ).auth = { userId: 'user-1', role: 'user' };
        next();
    }),
    requireRole: vi.fn(() => (_req: Request, _res: Response, next: NextFunction) => next()),
}));

vi.mock('../../controllers/me-controller', () => ({
    MeController: {
        me: vi.fn((_req: Request, res: Response) =>
            res.status(200).json({
                user: {
                    id: 'user-1',
                    username: 'alice123',
                    displayName: 'Alice',
                    email: 'alice@example.com',
                    role: 'user',
                },
            }),
        ),
        update: vi.fn((_req: Request, res: Response) =>
            res.status(200).json({
                user: {
                    id: 'user-1',
                    username: 'alice123',
                    displayName: 'Alice Tan',
                    email: 'alice@example.com',
                    role: 'user',
                },
            }),
        ),
        delete: vi.fn((_req: Request, res: Response) =>
            res.status(200).json({
                message: 'Account deleted successfully',
            }),
        ),
    },
}));

import { createApp } from '../../app';
import { MeController } from '../../controllers/me-controller';
import { requireAuth } from '../../middleware/auth-middleware';

describe('me routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('GET /me routes to MeController.me', async () => {
        const app = createApp();

        const res = await request(app).get('/me');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            user: {
                id: 'user-1',
                username: 'alice123',
                displayName: 'Alice',
                email: 'alice@example.com',
                role: 'user',
            },
        });
        expect(requireAuth).toHaveBeenCalled();
        expect(MeController.me).toHaveBeenCalled();
    });

    it('PATCH /me routes to MeController.update for valid body', async () => {
        const app = createApp();

        const res = await request(app).patch('/me').send({
            displayName: 'Alice Tan',
        });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            user: {
                id: 'user-1',
                username: 'alice123',
                displayName: 'Alice Tan',
                email: 'alice@example.com',
                role: 'user',
            },
        });
        expect(MeController.update).toHaveBeenCalled();
    });

    it('PATCH /me returns 400 for invalid body', async () => {
        const app = createApp();

        const res = await request(app).patch('/me').send({});

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('BAD_REQUEST');
        expect(res.body.error.message).toBe('Invalid request body');
        expect(MeController.update).not.toHaveBeenCalled();
    });

    it('DELETE /me routes to MeController.delete', async () => {
        const app = createApp();

        const res = await request(app).delete('/me');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            message: 'Account deleted successfully',
        });
        expect(MeController.delete).toHaveBeenCalled();
    });
});
