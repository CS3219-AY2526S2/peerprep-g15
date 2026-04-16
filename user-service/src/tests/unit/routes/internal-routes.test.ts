import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../../utils/app-error';

vi.mock('../../../middleware/internal-auth-middleware', () => ({
    requireInternalService: vi.fn((req: Request, _res: Response, next: NextFunction) => {
        const token = req.header('X-Internal-Service-Token');

        if (token !== 'test-internal-secret') {
            return next(AppError.forbidden('Invalid internal service token'));
        }

        next();
    }),
}));

vi.mock('../../../controllers/internal-auth-controller', () => ({
    InternalAuthController: {
        resolve: vi.fn((_req: Request, res: Response) =>
            res.status(200).json({
                user: {
                    id: 'user-1',
                    username: 'alice123',
                    displayName: 'Alice',
                    email: 'alice@example.com',
                    role: 'admin',
                },
            }),
        ),
    },
}));

import { createApp } from '../../../app';
import { InternalAuthController } from '../../../controllers/internal-auth-controller';

describe('internal routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('POST /internal/auth/resolve routes to controller for valid internal token and body', async () => {
        const app = createApp();

        const res = await request(app)
            .post('/internal/auth/resolve')
            .set('X-Internal-Service-Token', 'test-internal-secret')
            .send({
                accessToken: 'valid-access-token',
            });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            user: {
                id: 'user-1',
                username: 'alice123',
                displayName: 'Alice',
                email: 'alice@example.com',
                role: 'admin',
            },
        });
        expect(InternalAuthController.resolve).toHaveBeenCalled();
    });

    it('POST /internal/auth/resolve returns 403 when internal service token is missing', async () => {
        const app = createApp();

        const res = await request(app).post('/internal/auth/resolve').send({
            accessToken: 'valid-access-token',
        });

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('POST /internal/auth/resolve returns 403 when internal service token is invalid', async () => {
        const app = createApp();

        const res = await request(app)
            .post('/internal/auth/resolve')
            .set('X-Internal-Service-Token', 'wrong-secret')
            .send({
                accessToken: 'valid-access-token',
            });

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('POST /internal/auth/resolve returns 400 for invalid request body', async () => {
        const app = createApp();

        const res = await request(app)
            .post('/internal/auth/resolve')
            .set('X-Internal-Service-Token', 'test-internal-secret')
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('BAD_REQUEST');
        expect(res.body.error.message).toBe('Invalid request body');
        expect(InternalAuthController.resolve).not.toHaveBeenCalled();
    });
});
