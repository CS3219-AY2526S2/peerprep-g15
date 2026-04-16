import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import request from 'supertest';
import { startTestServer, stopTestServer } from '../helpers/test-server';
import { setAuthServiceFetch } from '../../services/auth-service';

function getAuthHeader(userId: string, role: 'user' | 'admin' = 'user') {
    return `Bearer mock:${role}:${userId}`;
}

function buildAuthResolveResponse(status: number, body: unknown) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'Content-Type': 'application/json',
        },
    });
}

describe('Attempt API Integration', () => {
    let server: Server;

    beforeAll(async () => {
        process.env.INTERNAL_SERVICE_TOKEN = 'history-service-test-token';

        setAuthServiceFetch(async (_input, init) => {
            const internalToken = init?.headers
                ? (init.headers as Record<string, string>)['X-Internal-Service-Token']
                : undefined;

            if (internalToken !== process.env.INTERNAL_SERVICE_TOKEN) {
                return buildAuthResolveResponse(403, {
                    message: 'Internal token mismatch',
                });
            }

            const body = JSON.parse(String(init?.body ?? '{}')) as { accessToken?: unknown };
            const accessToken = typeof body.accessToken === 'string' ? body.accessToken : '';
            const [prefix, role, userId] = accessToken.split(':');

            if (prefix !== 'mock' || (role !== 'user' && role !== 'admin') || !userId) {
                return buildAuthResolveResponse(401, {
                    message: 'Invalid token',
                });
            }

            return buildAuthResolveResponse(200, {
                user: {
                    id: userId,
                    role,
                },
            });
        });

        server = await startTestServer();
    }, 60000);

    afterAll(async () => {
        setAuthServiceFetch();

        if (server) {
            await stopTestServer(server);
        }
    });

    describe('POST /save-attempt', () => {
        it('should save attempt and return 201', async () => {
            const response = await request(server)
                .post('/save-attempt')
                .set('Authorization', getAuthHeader('user-123'))
                .send({
                    userId: 'user-123',
                    language: 'typescript',
                    code: 'function test() {}',
                    passed: true,
                    questionId: 'q-1',
                    roomId: 'room-1',
                });

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('attempt');
            expect(response.body.attempt).toHaveProperty('attemptId');
            expect(response.body.attempt.userId).toBe('user-123');
            expect(response.body.attempt.passed).toBe(true);
        });

        it('should return 400 on missing required fields', async () => {
            const response = await request(server)
                .post('/save-attempt')
                .set('Authorization', getAuthHeader('user-123'))
                .send({
                    // missing userId
                    language: 'typescript',
                    code: 'function test() {}',
                    passed: true,
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('message');
        });

        it('should persist multiple attempts per user', async () => {
            // Save first attempt
            const first = await request(server)
                .post('/save-attempt')
                .set('Authorization', getAuthHeader('user-456'))
                .send({
                    userId: 'user-456',
                    language: 'python',
                    code: 'def test(): pass',
                    passed: false,
                    questionId: 'q-2',
                });

            expect(first.status).toBe(201);

            // Save second attempt
            const second = await request(server)
                .post('/save-attempt')
                .set('Authorization', getAuthHeader('user-456'))
                .send({
                    userId: 'user-456',
                    language: 'python',
                    code: 'def test(): return True',
                    passed: true,
                    questionId: 'q-3',
                });

            expect(second.status).toBe(201);

            // Retrieve attempts and verify both exist
            const history = await request(server)
                .get('/users/user-456/attempts')
                .set('Authorization', getAuthHeader('user-456'));

            expect(history.status).toBe(200);
            expect(history.body.items.length).toBe(2);
            expect(history.body.total).toBe(2);
        });

        it('should allow repeated attempts on same question', async () => {
            // Save first attempt on question
            const first = await request(server)
                .post('/save-attempt')
                .set('Authorization', getAuthHeader('user-789'))
                .send({
                    userId: 'user-789',
                    language: 'javascript',
                    code: 'function test() {}',
                    passed: false,
                    questionId: 'q-same',
                });

            expect(first.status).toBe(201);

            // Save second attempt on same question
            const second = await request(server)
                .post('/save-attempt')
                .set('Authorization', getAuthHeader('user-789'))
                .send({
                    userId: 'user-789',
                    language: 'javascript',
                    code: 'function test() { return 42; }',
                    passed: true,
                    questionId: 'q-same',
                });

            expect(second.status).toBe(201);

            // Both should be stored separately
            const history = await request(server)
                .get('/users/user-789/attempts')
                .set('Authorization', getAuthHeader('user-789'));

            expect(history.body.items.length).toBe(2);
            const attemptsForQuestion = history.body.items.filter(
                (a: { questionId: string }) => a.questionId === 'q-same',
            );
            expect(attemptsForQuestion.length).toBe(2);
        });
    });

    describe('GET /users/:userId/attempts', () => {
        it('should return all attempts for user', async () => {
            const saveRes = await request(server)
                .post('/save-attempt')
                .set('Authorization', getAuthHeader('user-abc'))
                .send({
                    userId: 'user-abc',
                    language: 'typescript',
                    code: 'const x = 1;',
                    passed: true,
                });

            expect(saveRes.status).toBe(201);

            const response = await request(server)
                .get('/users/user-abc/attempts')
                .set('Authorization', getAuthHeader('user-abc'));

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('items');
            expect(Array.isArray(response.body.items)).toBe(true);
            expect(response.body.items.length).toBeGreaterThan(0);
            expect(response.body).toHaveProperty('total');
            expect(response.body).toHaveProperty('limit');
            expect(response.body).toHaveProperty('skip');
        });

        it('should return newest attempts first', async () => {
            const userId = 'user-newest-test';

            // Save first attempt
            const first = await request(server)
                .post('/save-attempt')
                .set('Authorization', getAuthHeader(userId))
                .send({
                    userId,
                    language: 'python',
                    code: 'x = 1',
                    passed: false,
                    submittedAt: new Date('2026-04-13T08:00:00Z'),
                });

            expect(first.status).toBe(201);

            // Save second attempt (newer)
            const second = await request(server)
                .post('/save-attempt')
                .set('Authorization', getAuthHeader(userId))
                .send({
                    userId,
                    language: 'python',
                    code: 'x = 2',
                    passed: true,
                    submittedAt: new Date('2026-04-13T09:00:00Z'),
                });

            expect(second.status).toBe(201);

            // Get history and verify newest is first
            const history = await request(server)
                .get(`/users/${userId}/attempts`)
                .set('Authorization', getAuthHeader(userId));

            expect(history.body.items.length).toBe(2);
            // Newest attempt should come first
            expect(new Date(history.body.items[0].submittedAt).getTime()).toBeGreaterThanOrEqual(
                new Date(history.body.items[1].submittedAt).getTime(),
            );
        });

        it('should support pagination with limit and skip', async () => {
            const userId = 'user-pagination';

            // Save 5 attempts
            for (let i = 0; i < 5; i++) {
                const res = await request(server)
                    .post('/save-attempt')
                    .set('Authorization', getAuthHeader(userId))
                    .send({
                        userId,
                        language: 'typescript',
                        code: `attempt ${i}`,
                        passed: i % 2 === 0,
                        questionId: `q-${i}`,
                    });
                expect(res.status).toBe(201);
            }

            // Get first page (limit=2)
            const page1 = await request(server)
                .get(`/users/${userId}/attempts?limit=2`)
                .set('Authorization', getAuthHeader(userId));

            expect(page1.body.items.length).toBe(2);
            expect(page1.body.total).toBe(5);
            expect(page1.body.limit).toBe(2);
            expect(page1.body.skip).toBe(0);

            // Get second page (skip=2, limit=2)
            const page2 = await request(server)
                .get(`/users/${userId}/attempts?limit=2&skip=2`)
                .set('Authorization', getAuthHeader(userId));

            expect(page2.body.items.length).toBe(2);
            expect(page2.body.total).toBe(5);
            expect(page2.body.skip).toBe(2);
        });

        it('should return 400 when userId missing', async () => {
            const response = await request(server).get('/users//attempts');

            expect(response.status).toBe(404);
            expect(response.body).toBeDefined();
        });
    });

    describe('Admin and Auth routes', () => {
        it('should enforce user auth on read routes', async () => {
            const response = await request(server).get('/users/auth-check-user/attempts');

            expect(response.status).toBe(401);
            expect(response.body.message).toBe('Missing or invalid Authorization header');
        });

        it('should block users from reading another user history', async () => {
            const response = await request(server)
                .get('/users/target-user/attempts')
                .set('Authorization', getAuthHeader('other-user'));

            expect(response.status).toBe(403);
            expect(response.body.message).toBe('Forbidden: cannot access another user history');
        });

        it('should allow admin to read another user history', async () => {
            const save = await request(server)
                .post('/save-attempt')
                .set('Authorization', getAuthHeader('target-user'))
                .send({
                    userId: 'target-user',
                    language: 'typescript',
                    code: 'const x = 1;',
                    passed: true,
                });

            expect(save.status).toBe(201);

            const response = await request(server)
                .get('/users/target-user/attempts')
                .set('Authorization', getAuthHeader('admin-user', 'admin'));

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body.items)).toBe(true);
        });

        it('should enforce user auth on save routes', async () => {
            const response = await request(server).post('/save-attempt').send({
                userId: 'save-auth-user',
                language: 'typescript',
                code: 'const x = 1;',
                passed: true,
            });

            expect(response.status).toBe(401);
            expect(response.body.message).toBe('Missing or invalid Authorization header');
        });

        it('should block users from saving attempts for another user', async () => {
            const response = await request(server)
                .post('/save-attempt')
                .set('Authorization', getAuthHeader('other-user'))
                .send({
                    userId: 'target-user',
                    language: 'typescript',
                    code: 'const x = 1;',
                    passed: true,
                });

            expect(response.status).toBe(403);
            expect(response.body.message).toBe('Forbidden: cannot save attempt for another user');
        });

        it('should allow admin to save attempts for another user', async () => {
            const response = await request(server)
                .post('/save-attempt')
                .set('Authorization', getAuthHeader('admin-user', 'admin'))
                .send({
                    userId: 'admin-target-user',
                    language: 'typescript',
                    code: 'const x = 1;',
                    passed: true,
                });

            expect(response.status).toBe(201);
            expect(response.body.attempt.userId).toBe('admin-target-user');
        });

        it('should reject internal save without internal token', async () => {
            const response = await request(server).post('/internal/save-attempt').send({
                userId: 'internal-user',
                language: 'typescript',
                code: 'const x = 1;',
                passed: true,
            });

            expect(response.status).toBe(403);
            expect(response.body.message).toBe('Forbidden');
        });

        it('should allow internal save with valid internal token', async () => {
            const response = await request(server)
                .post('/internal/save-attempt')
                .set('x-internal-service-token', process.env.INTERNAL_SERVICE_TOKEN as string)
                .send({
                    userId: 'internal-user',
                    language: 'typescript',
                    code: 'const x = 1;',
                    passed: true,
                });

            expect(response.status).toBe(201);
            expect(response.body.attempt.userId).toBe('internal-user');
        });
    });
});
