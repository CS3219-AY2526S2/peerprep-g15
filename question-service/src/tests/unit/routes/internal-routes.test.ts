import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../models/question-model', () => ({
    Question: {
        findOne: vi.fn(),
    },
}));

import { Question } from '../../../models/question-model';
import { internalRouter } from '../../../routes/internal-routes';
import { config } from '../../../config/env';

function buildApp() {
    const app = express();
    app.use('/internal', internalRouter);
    return app;
}

describe('internal routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        config.userService.internalServiceToken = 'internal-secret';
    });

    it('returns 401 when token is missing', async () => {
        const app = buildApp();

        const res = await request(app).get('/internal/questions/1');

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ message: 'Unauthorized' });
    });

    it('returns 401 when token is wrong', async () => {
        const app = buildApp();

        const res = await request(app)
            .get('/internal/questions/1')
            .set('x-internal-service-token', 'wrong');

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ message: 'Unauthorized' });
    });

    it('returns 400 for invalid question id', async () => {
        const app = buildApp();

        const res = await request(app)
            .get('/internal/questions/abc')
            .set('x-internal-service-token', 'internal-secret');

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ message: 'Invalid question id' });
    });

    it('returns 404 when question does not exist', async () => {
        const app = buildApp();
        vi.mocked(Question.findOne).mockResolvedValue(null);

        const res = await request(app)
            .get('/internal/questions/99')
            .set('x-internal-service-token', 'internal-secret');

        expect(Question.findOne).toHaveBeenCalledWith({ questionId: 99 });
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ message: 'Question not found' });
    });

    it('returns 200 with question when found', async () => {
        const app = buildApp();
        const question = { questionId: 99, title: 'Two Sum' };
        vi.mocked(Question.findOne).mockResolvedValue(question as never);

        const res = await request(app)
            .get('/internal/questions/99')
            .set('x-internal-service-token', 'internal-secret');

        expect(res.status).toBe(200);
        expect(res.body).toEqual(question);
    });
});
