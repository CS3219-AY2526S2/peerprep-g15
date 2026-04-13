import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { NextFunction, Request, Response } from 'express';

vi.mock('../../../middleware/auth-middleware', () => ({
    requireAuth: vi.fn((req: Request, _res: Response, next: NextFunction) => {
        (
            req as Request & {
                auth?: { userId: string; role: 'admin' | 'user' };
            }
        ).auth = { userId: 'admin-1', role: 'admin' };
        next();
    }),
    requireRole: vi.fn(
        (_role: 'admin' | 'user') => (_req: Request, _res: Response, next: NextFunction) => next(),
    ),
}));

vi.mock('../../../controllers/admin-controller', () => ({
    AdminController: {
        home: vi.fn((_req: Request, res: Response) =>
            res.status(200).json({ message: 'Admin home' }),
        ),
        listUsers: vi.fn((_req: Request, res: Response) =>
            res.status(200).json({
                users: [],
                pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
            }),
        ),
        promote: vi.fn((_req: Request, res: Response) =>
            res.status(200).json({
                message: 'User promoted to admin',
                user: { username: 'alice123', role: 'admin' },
            }),
        ),
        demote: vi.fn((_req: Request, res: Response) =>
            res.status(200).json({
                message: 'User demoted to normal user',
                user: { username: 'alice123', role: 'user' },
            }),
        ),
        deleteUser: vi.fn((_req: Request, res: Response) =>
            res.status(200).json({
                message: "User 'alice123' deleted successfully",
            }),
        ),
    },
}));

import { createApp } from '../../../app';
import { AdminController } from '../../../controllers/admin-controller';
import { requireAuth, requireRole } from '../../../middleware/auth-middleware';

describe('admin routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('GET /admin/home routes to AdminController.home', async () => {
        const app = createApp();

        const res = await request(app).get('/admin/home');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ message: 'Admin home' });
        expect(requireAuth).toHaveBeenCalled();
        expect(AdminController.home).toHaveBeenCalled();
    });

    it('GET /admin/users routes to AdminController.listUsers for valid query', async () => {
        const app = createApp();

        const res = await request(app).get('/admin/users?search=alice&role=admin&page=1&limit=10');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            users: [],
            pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        });
        expect(AdminController.listUsers).toHaveBeenCalled();
    });

    it('GET /admin/users returns 400 for invalid query params', async () => {
        const app = createApp();

        const res = await request(app).get('/admin/users?role=superadmin');

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('BAD_REQUEST');
        expect(res.body.error.message).toBe('Invalid query parameters');
        expect(AdminController.listUsers).not.toHaveBeenCalled();
    });

    it('POST /admin/promote routes to AdminController.promote for valid body', async () => {
        const app = createApp();

        const res = await request(app).post('/admin/promote').send({
            username: 'alice123',
        });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            message: 'User promoted to admin',
            user: { username: 'alice123', role: 'admin' },
        });
        expect(AdminController.promote).toHaveBeenCalled();
    });

    it('POST /admin/promote returns 400 for invalid body', async () => {
        const app = createApp();

        const res = await request(app).post('/admin/promote').send({
            username: 'ab',
        });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('BAD_REQUEST');
        expect(res.body.error.message).toBe('Invalid request body');
        expect(AdminController.promote).not.toHaveBeenCalled();
    });

    it('POST /admin/demote routes to AdminController.demote for valid body', async () => {
        const app = createApp();

        const res = await request(app).post('/admin/demote').send({
            username: 'alice123',
        });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            message: 'User demoted to normal user',
            user: { username: 'alice123', role: 'user' },
        });
        expect(AdminController.demote).toHaveBeenCalled();
    });

    it('POST /admin/demote returns 400 for invalid body', async () => {
        const app = createApp();

        const res = await request(app).post('/admin/demote').send({
            username: 'alice bob',
        });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('BAD_REQUEST');
        expect(res.body.error.message).toBe('Invalid request body');
        expect(AdminController.demote).not.toHaveBeenCalled();
    });

    it('DELETE /admin/users/:username routes to AdminController.deleteUser', async () => {
        const app = createApp();

        const res = await request(app).delete('/admin/users/alice123');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            message: "User 'alice123' deleted successfully",
        });
        expect(AdminController.deleteUser).toHaveBeenCalled();
    });
});
