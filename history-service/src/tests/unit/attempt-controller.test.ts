import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AttemptController } from '../../controllers/attempt-controller';
import { getAttemptHistory, saveAttempt } from '../../services/attempt-service';

vi.mock('../../services/attempt-service', () => ({
    saveAttempt: vi.fn(),
    getAttemptHistory: vi.fn(),
}));

function createMockResponse() {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));

    return {
        status,
        json,
    };
}

describe('AttemptController', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('save', () => {
        it('should validate required fields', async () => {
            const req = {
                body: {},
            } as Request;
            const res = createMockResponse();
            const next = vi.fn() as NextFunction;

            await AttemptController.save(req, res as unknown as Response, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.status.mock.results[0].value.json).toHaveBeenCalledWith({
                message: 'userId, language, code, and passed are required',
            });
            expect(saveAttempt).not.toHaveBeenCalled();
        });

        it('should reject request without userId', async () => {
            const req = {
                body: {
                    language: 'typescript',
                    code: 'console.log(1)',
                    passed: true,
                },
            } as Request;
            const res = createMockResponse();
            const next = vi.fn() as NextFunction;

            await AttemptController.save(req, res as unknown as Response, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(saveAttempt).not.toHaveBeenCalled();
        });

        it('should reject request without language', async () => {
            const req = {
                body: {
                    userId: 'user-1',
                    code: 'console.log(1)',
                    passed: true,
                },
            } as Request;
            const res = createMockResponse();
            const next = vi.fn() as NextFunction;

            await AttemptController.save(req, res as unknown as Response, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(saveAttempt).not.toHaveBeenCalled();
        });

        it('should reject request without code', async () => {
            const req = {
                body: {
                    userId: 'user-1',
                    language: 'typescript',
                    passed: true,
                },
            } as Request;
            const res = createMockResponse();
            const next = vi.fn() as NextFunction;

            await AttemptController.save(req, res as unknown as Response, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(saveAttempt).not.toHaveBeenCalled();
        });

        it('should reject request without passed', async () => {
            const req = {
                body: {
                    userId: 'user-1',
                    language: 'typescript',
                    code: 'console.log(1)',
                },
            } as Request;
            const res = createMockResponse();
            const next = vi.fn() as NextFunction;

            await AttemptController.save(req, res as unknown as Response, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(saveAttempt).not.toHaveBeenCalled();
        });

        it('should call service and return 201 for valid payload', async () => {
            vi.mocked(saveAttempt).mockResolvedValueOnce({
                attemptId: 'a-1',
                userId: 'user-1',
                language: 'typescript',
                code: 'console.log(1)',
                passed: true,
                submittedAt: new Date(),
            } as never);

            const req = {
                body: {
                    userId: ' user-1 ',
                    language: ' typescript ',
                    code: 'console.log(1)',
                    passed: 'true',
                    questionTitle: ' two-sum ',
                },
            } as Request;
            const res = createMockResponse();
            const next = vi.fn() as NextFunction;

            await AttemptController.save(req, res as unknown as Response, next);

            expect(saveAttempt).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: 'user-1',
                    language: 'typescript',
                    passed: true,
                    questionTitle: 'two-sum',
                }),
            );
            expect(res.status).toHaveBeenCalledWith(201);
        });

        it('should call next when service throws', async () => {
            const error = new Error('save failed');
            vi.mocked(saveAttempt).mockRejectedValueOnce(error);

            const req = {
                body: {
                    userId: 'user-1',
                    language: 'typescript',
                    code: 'console.log(1)',
                    passed: true,
                },
            } as Request;
            const res = createMockResponse();
            const next = vi.fn() as NextFunction;

            await AttemptController.save(req, res as unknown as Response, next);

            expect(next).toHaveBeenCalledWith(error);
        });
    });

    describe('listByUser', () => {
        it('should require userId parameter', async () => {
            const req = {
                params: { userId: '   ' },
                query: {},
            } as unknown as Request;
            const res = createMockResponse();
            const next = vi.fn() as NextFunction;

            await AttemptController.listByUser(req, res as unknown as Response, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(getAttemptHistory).not.toHaveBeenCalled();
        });

        it('should validate pagination limit and skip', async () => {
            vi.mocked(getAttemptHistory).mockResolvedValueOnce({
                items: [],
                total: 0,
                limit: 10,
                skip: 5,
            });

            const req = {
                params: { userId: ' user-1 ' },
                query: { limit: '10', skip: '5' },
            } as unknown as Request;
            const res = createMockResponse();
            const next = vi.fn() as NextFunction;

            await AttemptController.listByUser(req, res as unknown as Response, next);

            expect(getAttemptHistory).toHaveBeenCalledWith({
                userId: 'user-1',
                limit: 10,
                skip: 5,
            });
            expect(res.status).toHaveBeenCalledWith(200);
        });

        it('should call next when service throws', async () => {
            const error = new Error('query failed');
            vi.mocked(getAttemptHistory).mockRejectedValueOnce(error);

            const req = {
                params: { userId: 'user-1' },
                query: {},
            } as unknown as Request;
            const res = createMockResponse();
            const next = vi.fn() as NextFunction;

            await AttemptController.listByUser(req, res as unknown as Response, next);

            expect(next).toHaveBeenCalledWith(error);
        });
    });

    describe('health', () => {
        it('should return health status', () => {
            const req = {} as Request;
            const res = createMockResponse();

            AttemptController.health(req, res as unknown as Response);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.status.mock.results[0].value.json).toHaveBeenCalledWith({
                status: 'ok',
                service: 'history-service',
            });
        });
    });
});
