import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireAuthMock, requireRoleMock, roleMiddlewareMock } = vi.hoisted(() => {
    return {
        requireAuthMock: vi.fn((req, _res, next) => next()),
        requireRoleMock: vi.fn(),
        roleMiddlewareMock: vi.fn((_req, _res, next) => next()),
    };
});

vi.mock('../../../middleware/auth-middleware', () => {
    requireRoleMock.mockImplementation(() => roleMiddlewareMock);

    return {
        requireAuth: requireAuthMock,
        requireRole: requireRoleMock,
    };
});

vi.mock('../../../controllers/question-controller', () => {
    return {
        getQuestions: vi.fn((_req, res) => res.status(200).json({ route: 'getQuestions' })),
        getQuestionById: vi.fn((_req, res) => res.status(200).json({ route: 'getQuestionById' })),
        createQuestion: vi.fn((_req, res) => res.status(201).json({ route: 'createQuestion' })),
        updateQuestion: vi.fn((_req, res) => res.status(200).json({ route: 'updateQuestion' })),
        deleteQuestion: vi.fn((_req, res) => res.status(200).json({ route: 'deleteQuestion' })),
    };
});

import { questionRouter } from '../../../routes/question-routes';
import * as questionController from '../../../controllers/question-controller';

function buildApp() {
    const app = express();
    app.use(express.json());
    app.use('/questions', questionRouter);
    return app;
}

describe('question routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('GET /questions uses requireAuth and getQuestions', async () => {
        const app = buildApp();

        const res = await request(app).get('/questions');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ route: 'getQuestions' });
        expect(requireAuthMock).toHaveBeenCalled();
        expect(questionController.getQuestions).toHaveBeenCalled();
    });

    it('GET /questions/:id uses requireAuth and getQuestionById', async () => {
        const app = buildApp();

        const res = await request(app).get('/questions/1');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ route: 'getQuestionById' });
        expect(requireAuthMock).toHaveBeenCalled();
        expect(questionController.getQuestionById).toHaveBeenCalled();
    });

    it('POST /questions uses auth, admin role middleware, and createQuestion', async () => {
        const app = buildApp();

        const res = await request(app).post('/questions').send({ title: 'X' });

        expect(res.status).toBe(201);
        expect(res.body).toEqual({ route: 'createQuestion' });
        expect(requireAuthMock).toHaveBeenCalled();
        expect(roleMiddlewareMock).toHaveBeenCalled();
        expect(questionController.createQuestion).toHaveBeenCalled();
    });

    it('PUT /questions/:id uses auth, admin role middleware, and updateQuestion', async () => {
        const app = buildApp();

        const res = await request(app).put('/questions/1').send({ title: 'Y' });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ route: 'updateQuestion' });
        expect(requireAuthMock).toHaveBeenCalled();
        expect(roleMiddlewareMock).toHaveBeenCalled();
        expect(questionController.updateQuestion).toHaveBeenCalled();
    });

    it('DELETE /questions/:id uses auth, admin role middleware, and deleteQuestion', async () => {
        const app = buildApp();

        const res = await request(app).delete('/questions/1');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ route: 'deleteQuestion' });
        expect(requireAuthMock).toHaveBeenCalled();
        expect(roleMiddlewareMock).toHaveBeenCalled();
        expect(questionController.deleteQuestion).toHaveBeenCalled();
    });
});
