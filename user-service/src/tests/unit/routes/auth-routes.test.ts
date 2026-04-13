import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Request, Response } from 'express';

vi.mock('../../../controllers/auth-controller', () => ({
    AuthController: {
        register: vi.fn((_req: Request, res: Response) =>
            res.status(201).json({
                user: {
                    id: 'user-1',
                    username: 'alice123',
                    email: 'alice@example.com',
                    role: 'user',
                },
                accessToken: 'access-token',
            }),
        ),
        login: vi.fn((_req: Request, res: Response) =>
            res.status(200).json({
                user: {
                    id: 'user-1',
                    username: 'alice123',
                    email: 'alice@example.com',
                    role: 'user',
                },
                accessToken: 'access-token',
            }),
        ),
        refresh: vi.fn((_req: Request, res: Response) =>
            res.status(200).json({
                accessToken: 'new-access-token',
            }),
        ),
        logout: vi.fn((_req: Request, res: Response) =>
            res.status(200).json({
                message: 'Logged out',
            }),
        ),
    },
}));

import { createApp } from '../../../app';
import { AuthController } from '../../../controllers/auth-controller';

describe('auth routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('POST /auth/register routes to AuthController.register for valid body', async () => {
        const app = createApp();

        const res = await request(app).post('/auth/register').send({
            username: 'alice123',
            displayName: 'Alice',
            email: 'alice@example.com',
            password: 'password123',
        });

        expect(res.status).toBe(201);
        expect(res.body).toEqual({
            user: {
                id: 'user-1',
                username: 'alice123',
                email: 'alice@example.com',
                role: 'user',
            },
            accessToken: 'access-token',
        });
        expect(AuthController.register).toHaveBeenCalled();
    });

    it('POST /auth/register returns 400 for invalid body', async () => {
        const app = createApp();

        const res = await request(app).post('/auth/register').send({
            username: 'ab',
            email: 'not-an-email',
            password: 'short',
        });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('BAD_REQUEST');
        expect(res.body.error.message).toBe('Invalid request body');
        expect(AuthController.register).not.toHaveBeenCalled();
    });

    it('POST /auth/login routes to AuthController.login for valid body', async () => {
        const app = createApp();

        const res = await request(app).post('/auth/login').send({
            identifier: 'alice123',
            password: 'password123',
        });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            user: {
                id: 'user-1',
                username: 'alice123',
                email: 'alice@example.com',
                role: 'user',
            },
            accessToken: 'access-token',
        });
        expect(AuthController.login).toHaveBeenCalled();
    });

    it('POST /auth/login returns 400 for invalid body', async () => {
        const app = createApp();

        const res = await request(app).post('/auth/login').send({
            identifier: '   ',
            password: '',
        });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('BAD_REQUEST');
        expect(res.body.error.message).toBe('Invalid request body');
        expect(AuthController.login).not.toHaveBeenCalled();
    });

    it('POST /auth/refresh routes to AuthController.refresh', async () => {
        const app = createApp();

        const res = await request(app).post('/auth/refresh');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            accessToken: 'new-access-token',
        });
        expect(AuthController.refresh).toHaveBeenCalled();
    });

    it('POST /auth/logout routes to AuthController.logout', async () => {
        const app = createApp();

        const res = await request(app).post('/auth/logout');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            message: 'Logged out',
        });
        expect(AuthController.logout).toHaveBeenCalled();
    });
});
