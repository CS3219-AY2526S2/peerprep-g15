import { randomUUID } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AttemptModel } from '../../models/attempt-model';
import { getAttemptHistory, saveAttempt } from '../../services/attempt-service';

vi.mock('crypto', () => ({
    randomUUID: vi.fn(),
}));

vi.mock('../../models/attempt-model', () => ({
    AttemptModel: {
        create: vi.fn(),
        find: vi.fn(),
        countDocuments: vi.fn(),
    },
}));

describe('AttemptService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('saveAttempt', () => {
        it('should create attempt with required fields', async () => {
            vi.mocked(randomUUID).mockReturnValue('11111111-1111-1111-1111-111111111111');
            vi.mocked(AttemptModel.create).mockResolvedValueOnce({
                toObject: () => ({
                    attemptId: '11111111-1111-1111-1111-111111111111',
                    userId: 'user-1',
                    language: 'typescript',
                    code: 'console.log(1)',
                    passed: true,
                    submittedAt: new Date('2026-01-01T00:00:00.000Z'),
                }),
            } as never);

            await saveAttempt({
                userId: ' user-1 ',
                language: ' typescript ',
                code: 'console.log(1)',
                passed: true,
            });

            expect(AttemptModel.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    attemptId: '11111111-1111-1111-1111-111111111111',
                    userId: 'user-1',
                    language: 'typescript',
                    code: 'console.log(1)',
                    passed: true,
                }),
            );
        });

        it('should generate unique attemptId', async () => {
            vi.mocked(randomUUID)
                .mockReturnValueOnce('11111111-1111-1111-1111-111111111111')
                .mockReturnValueOnce('22222222-2222-2222-2222-222222222222');
            vi.mocked(AttemptModel.create).mockResolvedValue({
                toObject: () => ({}),
            } as never);

            await saveAttempt({ userId: 'u1', language: 'js', code: 'a', passed: true });
            await saveAttempt({ userId: 'u1', language: 'js', code: 'b', passed: false });

            expect(vi.mocked(AttemptModel.create).mock.calls[0][0]).toMatchObject({
                attemptId: '11111111-1111-1111-1111-111111111111',
            });
            expect(vi.mocked(AttemptModel.create).mock.calls[1][0]).toMatchObject({
                attemptId: '22222222-2222-2222-2222-222222222222',
            });
        });

        it('should set submittedAt to current time if not provided', async () => {
            vi.mocked(randomUUID).mockReturnValue('11111111-1111-1111-1111-111111111111');
            vi.mocked(AttemptModel.create).mockResolvedValueOnce({
                toObject: () => ({}),
            } as never);

            const before = Date.now();
            await saveAttempt({ userId: 'u1', language: 'ts', code: 'x', passed: true });
            const after = Date.now();

            const created = vi.mocked(AttemptModel.create).mock.calls[0][0] as {
                submittedAt: Date;
            };
            expect(created.submittedAt).toBeInstanceOf(Date);
            expect(created.submittedAt.getTime()).toBeGreaterThanOrEqual(before);
            expect(created.submittedAt.getTime()).toBeLessThanOrEqual(after);
        });

        it('should accept optional roomId and questionId', async () => {
            vi.mocked(randomUUID).mockReturnValue('11111111-1111-1111-1111-111111111111');
            vi.mocked(AttemptModel.create).mockResolvedValueOnce({
                toObject: () => ({}),
            } as never);

            await saveAttempt({
                userId: 'u1',
                roomId: ' room-1 ',
                questionId: 'q-1',
                questionTitle: ' two-sum ',
                language: 'ts',
                code: 'x',
                passed: false,
            });

            expect(AttemptModel.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    roomId: 'room-1',
                    questionId: 'q-1',
                    questionTitle: 'two-sum',
                }),
            );
        });
    });

    describe('getAttemptHistory', () => {
        it('should return paginated attempts for userId', async () => {
            const items = [{ attemptId: 'a1' }, { attemptId: 'a2' }];
            const chain = {
                sort: vi.fn().mockReturnThis(),
                skip: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                lean: vi.fn().mockResolvedValue(items),
            };

            vi.mocked(AttemptModel.find).mockReturnValueOnce(chain as never);
            vi.mocked(AttemptModel.countDocuments).mockResolvedValueOnce(2 as never);

            const result = await getAttemptHistory({ userId: ' user-1 ' });

            expect(AttemptModel.find).toHaveBeenCalledWith({ userId: 'user-1' });
            expect(result.items).toEqual(items);
            expect(result.total).toBe(2);
            expect(result.limit).toBe(50);
            expect(result.skip).toBe(0);
        });

        it('should sort by submittedAt descending', async () => {
            const chain = {
                sort: vi.fn().mockReturnThis(),
                skip: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                lean: vi.fn().mockResolvedValue([]),
            };

            vi.mocked(AttemptModel.find).mockReturnValueOnce(chain as never);
            vi.mocked(AttemptModel.countDocuments).mockResolvedValueOnce(0 as never);

            await getAttemptHistory({ userId: 'user-1' });

            expect(chain.sort).toHaveBeenCalledWith({ submittedAt: -1, _id: -1 });
        });

        it('should enforce pagination limits', async () => {
            const chainMin = {
                sort: vi.fn().mockReturnThis(),
                skip: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                lean: vi.fn().mockResolvedValue([]),
            };
            const chainMax = {
                sort: vi.fn().mockReturnThis(),
                skip: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                lean: vi.fn().mockResolvedValue([]),
            };

            vi.mocked(AttemptModel.find)
                .mockReturnValueOnce(chainMin as never)
                .mockReturnValueOnce(chainMax as never);
            vi.mocked(AttemptModel.countDocuments).mockResolvedValue(0 as never);

            await getAttemptHistory({ userId: 'user-1', limit: 0 });
            await getAttemptHistory({ userId: 'user-1', limit: 1000 });

            expect(chainMin.limit).toHaveBeenCalledWith(1);
            expect(chainMax.limit).toHaveBeenCalledWith(200);
        });

        it('should handle skip offset correctly', async () => {
            const chain = {
                sort: vi.fn().mockReturnThis(),
                skip: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                lean: vi.fn().mockResolvedValue([]),
            };

            vi.mocked(AttemptModel.find).mockReturnValueOnce(chain as never);
            vi.mocked(AttemptModel.countDocuments).mockResolvedValueOnce(0 as never);

            await getAttemptHistory({ userId: 'user-1', skip: -10 });

            expect(chain.skip).toHaveBeenCalledWith(0);
        });
    });
});
