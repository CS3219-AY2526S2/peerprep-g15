import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

vi.mock('../../../models/question-model', () => {
    return {
        Question: {
            find: vi.fn(),
            findOne: vi.fn(),
            create: vi.fn(),
            findOneAndUpdate: vi.fn(),
            findOneAndDelete: vi.fn(),
        },
    };
});

import { Question } from '../../../models/question-model';
import {
    getQuestions,
    getQuestionById,
    createQuestion,
    updateQuestion,
    deleteQuestion,
} from '../../../controllers/question-controller';

function createMockRes() {
    return {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
    } as unknown as Response;
}

describe('question-controller', () => {
    const next = vi.fn() as NextFunction;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('getQuestions returns sorted questions with empty filter', async () => {
        const req = { query: {} } as unknown as Request;
        const res = createMockRes();

        const sort = vi.fn().mockResolvedValue([{ questionId: 1 }]);
        vi.mocked(Question.find).mockReturnValue({ sort } as never);

        await getQuestions(req, res, next);

        expect(Question.find).toHaveBeenCalledWith({});
        expect(sort).toHaveBeenCalledWith({ questionId: 1 });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith([{ questionId: 1 }]);
    });

    it('getQuestions applies difficulty and category filters', async () => {
        const req = {
            query: { difficulty: 'Easy', category: 'Array' },
        } as unknown as Request;
        const res = createMockRes();

        const sort = vi.fn().mockResolvedValue([{ questionId: 2 }]);
        vi.mocked(Question.find).mockReturnValue({ sort } as never);

        await getQuestions(req, res, next);

        expect(Question.find).toHaveBeenCalledWith({
            difficulty: 'Easy',
            categories: 'Array',
        });
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('getQuestionById returns 400 for invalid id', async () => {
        const req = { params: { id: 'abc' } } as unknown as Request;
        const res = createMockRes();

        await getQuestionById(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: 'Invalid question id' });
    });

    it('getQuestionById returns 404 when missing', async () => {
        const req = { params: { id: '5' } } as unknown as Request;
        const res = createMockRes();

        vi.mocked(Question.findOne).mockResolvedValue(null);

        await getQuestionById(req, res, next);

        expect(Question.findOne).toHaveBeenCalledWith({ questionId: 5 });
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ message: 'Question not found' });
    });

    it('getQuestionById returns question when found', async () => {
        const req = { params: { id: '5' } } as unknown as Request;
        const res = createMockRes();
        const question = { questionId: 5, title: 'Two Sum' };

        vi.mocked(Question.findOne).mockResolvedValue(question as never);

        await getQuestionById(req, res, next);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(question);
    });

    it('createQuestion returns 409 when similar normalized title already exists', async () => {
        const req = {
            body: { questionId: 1, title: 'Two   Sum!!!' },
        } as Request;
        const res = createMockRes();

        const select = vi.fn().mockReturnThis();
        const lean = vi.fn().mockResolvedValue({
            questionId: 99,
            title: 'Two Sum',
        });

        vi.mocked(Question.findOne).mockReturnValue({ select, lean } as never);

        await createQuestion(req, res, next);

        expect(Question.findOne).toHaveBeenCalledWith({
            normalizedTitle: 'two sum',
        });
        expect(select).toHaveBeenCalledWith('questionId title');
        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith({
            message: 'A question with a very similar title already exists',
            existingQuestion: {
                questionId: 99,
                title: 'Two Sum',
            },
        });
        expect(Question.create).not.toHaveBeenCalled();
    });

    it('createQuestion creates and returns 201 when no duplicate-like title exists', async () => {
        const req = {
            body: { questionId: 1, title: 'Two Sum' },
        } as Request;
        const res = createMockRes();

        const select = vi.fn().mockReturnThis();
        const lean = vi.fn().mockResolvedValue(null);

        vi.mocked(Question.findOne).mockReturnValue({ select, lean } as never);

        const created = { questionId: 1, title: 'Two Sum' };
        vi.mocked(Question.create).mockResolvedValue(created as never);

        await createQuestion(req, res, next);

        expect(Question.create).toHaveBeenCalledWith(req.body);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(created);
    });

    it('createQuestion returns 409 on duplicate key error', async () => {
        const req = {
            body: { questionId: 1, title: 'Two Sum' },
        } as Request;
        const res = createMockRes();

        const select = vi.fn().mockReturnThis();
        const lean = vi.fn().mockResolvedValue(null);

        vi.mocked(Question.findOne).mockReturnValue({ select, lean } as never);

        vi.mocked(Question.create).mockRejectedValue({
            code: 11000,
            keyPattern: { contentFingerprint: 1 },
        });

        await createQuestion(req, res, next);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith({
            message: 'Duplicate question detected',
            details: { contentFingerprint: 1 },
        });
    });

    it('updateQuestion returns 400 for invalid id', async () => {
        const req = { params: { id: 'abc' }, body: {} } as unknown as Request;
        const res = createMockRes();

        await updateQuestion(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: 'Invalid question id' });
    });

    it('updateQuestion returns 400 when __v is missing', async () => {
        const req = {
            params: { id: '10' },
            body: { title: 'Updated' },
        } as unknown as Request;
        const res = createMockRes();

        await updateQuestion(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: 'Missing or invalid __v for concurrency control',
        });
    });

    it('updateQuestion performs version-checked update and strips immutable fields', async () => {
        const req = {
            params: { id: '10' },
            body: {
                __v: 3,
                _id: 'mongo-id',
                questionId: 999,
                createdAt: 'x',
                updatedAt: 'y',
                title: 'Updated',
                difficulty: 'Hard',
            },
        } as unknown as Request;
        const res = createMockRes();

        const updated = { questionId: 10, title: 'Updated', __v: 4 };
        vi.mocked(Question.findOneAndUpdate).mockResolvedValue(updated as never);

        await updateQuestion(req, res, next);

        expect(Question.findOneAndUpdate).toHaveBeenCalledWith(
            { questionId: 10, __v: 3 },
            {
                $set: {
                    title: 'Updated',
                    difficulty: 'Hard',
                },
                $inc: { __v: 1 },
            },
            {
                new: true,
                runValidators: true,
                context: 'query',
            },
        );
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(updated);
    });

    it('updateQuestion returns 404 when question does not exist', async () => {
        const req = {
            params: { id: '10' },
            body: { __v: 3, title: 'Updated' },
        } as unknown as Request;
        const res = createMockRes();

        vi.mocked(Question.findOneAndUpdate).mockResolvedValue(null);
        vi.mocked(Question.findOne).mockReturnValue({
            select: vi.fn().mockReturnThis(),
            lean: vi.fn().mockResolvedValue(null),
        } as never);

        await updateQuestion(req, res, next);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ message: 'Question not found' });
    });

    it('updateQuestion returns 409 when version is stale', async () => {
        const req = {
            params: { id: '10' },
            body: { __v: 3, title: 'Updated' },
        } as unknown as Request;
        const res = createMockRes();

        vi.mocked(Question.findOneAndUpdate).mockResolvedValue(null);
        vi.mocked(Question.findOne).mockReturnValue({
            select: vi.fn().mockReturnThis(),
            lean: vi.fn().mockResolvedValue({ __v: 4 }),
        } as never);

        await updateQuestion(req, res, next);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith({
            message: 'Question was modified by another admin. Refresh and try again.',
            currentVersion: 4,
        });
    });

    it('updateQuestion returns 409 on duplicate key error', async () => {
        const req = {
            params: { id: '10' },
            body: { __v: 3, title: 'Updated' },
        } as unknown as Request;
        const res = createMockRes();

        vi.mocked(Question.findOneAndUpdate).mockRejectedValue({
            code: 11000,
            keyPattern: { contentFingerprint: 1 },
        });

        await updateQuestion(req, res, next);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith({
            message: 'Update would create a duplicate question',
            details: { contentFingerprint: 1 },
        });
    });

    it('deleteQuestion returns 400 for invalid id', async () => {
        const req = { params: { id: 'bad' } } as unknown as Request;
        const res = createMockRes();

        await deleteQuestion(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: 'Invalid question id' });
    });

    it('deleteQuestion returns 404 when question missing', async () => {
        const req = { params: { id: '3' } } as unknown as Request;
        const res = createMockRes();

        vi.mocked(Question.findOneAndDelete).mockResolvedValue(null);

        await deleteQuestion(req, res, next);

        expect(Question.findOneAndDelete).toHaveBeenCalledWith({ questionId: 3 });
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ message: 'Question not found' });
    });

    it('deleteQuestion returns success message', async () => {
        const req = { params: { id: '3' } } as unknown as Request;
        const res = createMockRes();

        vi.mocked(Question.findOneAndDelete).mockResolvedValue({ questionId: 3 } as never);

        await deleteQuestion(req, res, next);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            message: 'Question deleted successfully',
        });
    });

    it('passes errors to next', async () => {
        const req = { query: {} } as unknown as Request;
        const res = createMockRes();
        const err = new Error('db failed');

        const sort = vi.fn().mockRejectedValue(err);
        vi.mocked(Question.find).mockReturnValue({ sort } as never);

        await getQuestions(req, res, next);

        expect(next).toHaveBeenCalledWith(err);
    });
});
