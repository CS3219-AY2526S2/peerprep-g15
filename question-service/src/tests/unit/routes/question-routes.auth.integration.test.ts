// src/tests/unit/routes/question-routes.auth.integration.test.ts
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../models/question-model', () => ({
    Question: {
        find: vi.fn(() => ({
            sort: vi.fn().mockResolvedValue([{ questionId: 1 }]),
        })),
        findOne: vi.fn().mockResolvedValue({ questionId: 1 }),
        create: vi.fn().mockResolvedValue({ questionId: 1 }),
        findOneAndUpdate: vi.fn().mockResolvedValue({ questionId: 1 }),
        findOneAndDelete: vi.fn().mockResolvedValue({ questionId: 1 }),
    },
}));

import { createApp } from '../../../app';
import { config } from '../../../config/env';

describe('question routes auth integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        config.userService.baseUrl = 'http://user-service';
        config.userService.internalServiceToken = 'internal-secret';
        vi.stubGlobal('fetch', vi.fn());
    });

    it('GET /questions returns 401 without bearer token', async () => {
        const app = createApp();

        const res = await request(app).get('/questions');

        expect(res.status).toBe(401);
        expect(res.body).toEqual({
            error: {
                code: 'UNAUTHORIZED',
                message: 'Missing or invalid Authorization header',
                details: undefined,
            },
        });
    });

    it('GET /questions succeeds with resolved user', async () => {
        vi.mocked(fetch).mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({
                user: {
                    id: 'u1',
                    username: 'john',
                    displayName: 'Johnny',
                    email: 'john@example.com',
                    role: 'user',
                },
            }),
        } as any);

        const app = createApp();

        const res = await request(app).get('/questions').set('Authorization', 'Bearer good-token');

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('POST /questions rejects non-admin user', async () => {
        vi.mocked(fetch).mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({
                user: {
                    id: 'u1',
                    username: 'john',
                    displayName: 'Johnny',
                    email: 'john@example.com',
                    role: 'user',
                },
            }),
        } as any);

        const app = createApp();

        const res = await request(app)
            .post('/questions')
            .set('Authorization', 'Bearer good-token')
            .send({ questionId: 1, title: 'X' });

        expect(res.status).toBe(403);
        expect(res.body).toEqual({
            error: {
                code: 'FORBIDDEN',
                message: 'Insufficient permissions',
                details: undefined,
            },
        });
    });
});
