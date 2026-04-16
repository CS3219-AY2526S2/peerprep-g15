import { beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { AdminService } from '../../../services/admin-service';

vi.mock('mongoose', () => ({
    default: {
        startSession: vi.fn(),
    },
}));

vi.mock('../../../models/user-model', () => ({
    UserModel: {
        findOne: vi.fn(),
        find: vi.fn(),
        countDocuments: vi.fn(),
    },
}));

import { UserModel } from '../../../models/user-model';

const makeSession = () => ({
    withTransaction: vi.fn(async (fn: () => Promise<unknown>) => await fn()),
    endSession: vi.fn(),
});

describe('AdminService.promote', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('throws not found when target user does not exist', async () => {
        vi.mocked(UserModel.findOne).mockResolvedValue(null);

        await expect(AdminService.promote('alice123')).rejects.toMatchObject({
            statusCode: 404,
            code: 'NOT_FOUND',
        });
    });

    it('throws conflict when target user is already an admin', async () => {
        vi.mocked(UserModel.findOne).mockResolvedValue({
            role: 'admin',
        } as any);

        await expect(AdminService.promote('alice123')).rejects.toMatchObject({
            statusCode: 409,
            code: 'CONFLICT',
        });
    });

    it('promotes a normal user and clears refresh session fields', async () => {
        const save = vi.fn();
        const toJSON = vi.fn().mockReturnValue({ username: 'alice123', role: 'admin' });

        const user = {
            role: 'user',
            refreshTokenHash: 'oldhash',
            refreshTokenIssuedAt: new Date(),
            save,
            toJSON,
        };

        vi.mocked(UserModel.findOne).mockResolvedValue(user as any);

        const result = await AdminService.promote('Alice123');

        expect(UserModel.findOne).toHaveBeenCalledWith({ username: 'alice123' });
        expect(user.role).toBe('admin');
        expect(user.refreshTokenHash).toBeNull();
        expect(user.refreshTokenIssuedAt).toBeNull();
        expect(save).toHaveBeenCalled();
        expect(result).toEqual({ username: 'alice123', role: 'admin' });
    });
});

describe('AdminService.demote', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('throws not found when target user does not exist', async () => {
        const session = makeSession();
        vi.mocked(mongoose.startSession).mockResolvedValue(session as any);

        const findSession = vi.fn().mockResolvedValue(null);
        vi.mocked(UserModel.findOne).mockReturnValue({
            session: findSession,
        } as any);

        await expect(AdminService.demote('actor-1', 'alice123')).rejects.toMatchObject({
            statusCode: 404,
            code: 'NOT_FOUND',
        });

        expect(UserModel.findOne).toHaveBeenCalledWith({ username: 'alice123' });
        expect(findSession).toHaveBeenCalledWith(session);
        expect(session.endSession).toHaveBeenCalled();
    });

    it('throws conflict when target user is already a normal user', async () => {
        const session = makeSession();
        vi.mocked(mongoose.startSession).mockResolvedValue(session as any);

        vi.mocked(UserModel.findOne).mockReturnValue({
            session: vi.fn().mockResolvedValue({
                role: 'user',
            }),
        } as any);

        await expect(AdminService.demote('actor-1', 'alice123')).rejects.toMatchObject({
            statusCode: 409,
            code: 'CONFLICT',
        });

        expect(session.endSession).toHaveBeenCalled();
    });

    it('throws forbidden on self-demotion', async () => {
        const session = makeSession();
        vi.mocked(mongoose.startSession).mockResolvedValue(session as any);

        vi.mocked(UserModel.findOne).mockReturnValue({
            session: vi.fn().mockResolvedValue({
                _id: { toString: () => 'actor-1' },
                role: 'admin',
            }),
        } as any);

        await expect(AdminService.demote('actor-1', 'alice123')).rejects.toMatchObject({
            statusCode: 403,
            code: 'FORBIDDEN',
        });

        expect(session.endSession).toHaveBeenCalled();
    });

    it('throws forbidden when attempting to demote the last remaining admin', async () => {
        const session = makeSession();
        vi.mocked(mongoose.startSession).mockResolvedValue(session as any);

        vi.mocked(UserModel.findOne).mockReturnValue({
            session: vi.fn().mockResolvedValue({
                _id: { toString: () => 'target-1' },
                role: 'admin',
            }),
        } as any);

        const countSession = vi.fn().mockResolvedValue(1);
        vi.mocked(UserModel.countDocuments).mockReturnValue({
            session: countSession,
        } as any);

        await expect(AdminService.demote('actor-1', 'alice123')).rejects.toMatchObject({
            statusCode: 403,
            code: 'FORBIDDEN',
        });

        expect(UserModel.countDocuments).toHaveBeenCalledWith({ role: 'admin' });
        expect(countSession).toHaveBeenCalledWith(session);
        expect(session.endSession).toHaveBeenCalled();
    });

    it('demotes another admin and clears refresh session fields', async () => {
        const session = makeSession();
        vi.mocked(mongoose.startSession).mockResolvedValue(session as any);

        const save = vi.fn();
        const toJSON = vi.fn().mockReturnValue({ username: 'alice123', role: 'user' });

        const user = {
            _id: { toString: () => 'target-1' },
            role: 'admin',
            refreshTokenHash: 'oldhash',
            refreshTokenIssuedAt: new Date(),
            save,
            toJSON,
        };

        const findSession = vi.fn().mockResolvedValue(user);
        vi.mocked(UserModel.findOne).mockReturnValue({
            session: findSession,
        } as any);

        const countSession = vi.fn().mockResolvedValue(2);
        vi.mocked(UserModel.countDocuments).mockReturnValue({
            session: countSession,
        } as any);

        const result = await AdminService.demote('actor-1', 'Alice123');

        expect(mongoose.startSession).toHaveBeenCalled();
        expect(session.withTransaction).toHaveBeenCalled();
        expect(UserModel.findOne).toHaveBeenCalledWith({ username: 'alice123' });
        expect(findSession).toHaveBeenCalledWith(session);
        expect(UserModel.countDocuments).toHaveBeenCalledWith({ role: 'admin' });
        expect(countSession).toHaveBeenCalledWith(session);
        expect(user.role).toBe('user');
        expect(user.refreshTokenHash).toBeNull();
        expect(user.refreshTokenIssuedAt).toBeNull();
        expect(save).toHaveBeenCalledWith({ session });
        expect(result).toEqual({ username: 'alice123', role: 'user' });
        expect(session.endSession).toHaveBeenCalled();
    });

    it('ends the session when save fails', async () => {
        const session = makeSession();
        vi.mocked(mongoose.startSession).mockResolvedValue(session as any);

        const user = {
            _id: { toString: () => 'target-1' },
            role: 'admin',
            refreshTokenHash: 'oldhash',
            refreshTokenIssuedAt: new Date(),
            save: vi.fn().mockRejectedValue(new Error('db write failed')),
            toJSON: vi.fn(),
        };

        vi.mocked(UserModel.findOne).mockReturnValue({
            session: vi.fn().mockResolvedValue(user),
        } as any);

        vi.mocked(UserModel.countDocuments).mockReturnValue({
            session: vi.fn().mockResolvedValue(2),
        } as any);

        await expect(AdminService.demote('actor-1', 'alice123')).rejects.toThrow('db write failed');
        expect(session.endSession).toHaveBeenCalled();
    });
});

describe('AdminService.deleteUser', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('throws not found when target user does not exist', async () => {
        const session = makeSession();
        vi.mocked(mongoose.startSession).mockResolvedValue(session as any);

        vi.mocked(UserModel.findOne).mockReturnValue({
            session: vi.fn().mockResolvedValue(null),
        } as any);

        await expect(AdminService.deleteUser('actor-1', 'alice123')).rejects.toMatchObject({
            statusCode: 404,
            code: 'NOT_FOUND',
        });

        expect(session.endSession).toHaveBeenCalled();
    });

    it('throws forbidden on self-delete via admin route', async () => {
        const session = makeSession();
        vi.mocked(mongoose.startSession).mockResolvedValue(session as any);

        vi.mocked(UserModel.findOne).mockReturnValue({
            session: vi.fn().mockResolvedValue({
                _id: { toString: () => 'actor-1' },
                role: 'admin',
            }),
        } as any);

        await expect(AdminService.deleteUser('actor-1', 'alice123')).rejects.toMatchObject({
            statusCode: 403,
            code: 'FORBIDDEN',
        });

        expect(session.endSession).toHaveBeenCalled();
    });

    it('throws forbidden when deleting the last remaining admin', async () => {
        const session = makeSession();
        vi.mocked(mongoose.startSession).mockResolvedValue(session as any);

        vi.mocked(UserModel.findOne).mockReturnValue({
            session: vi.fn().mockResolvedValue({
                _id: { toString: () => 'target-1' },
                role: 'admin',
            }),
        } as any);

        const countSession = vi.fn().mockResolvedValue(1);
        vi.mocked(UserModel.countDocuments).mockReturnValue({
            session: countSession,
        } as any);

        await expect(AdminService.deleteUser('actor-1', 'alice123')).rejects.toMatchObject({
            statusCode: 403,
            code: 'FORBIDDEN',
        });

        expect(UserModel.countDocuments).toHaveBeenCalledWith({ role: 'admin' });
        expect(countSession).toHaveBeenCalledWith(session);
        expect(session.endSession).toHaveBeenCalled();
    });

    it('deletes a normal user and returns normalized username', async () => {
        const session = makeSession();
        vi.mocked(mongoose.startSession).mockResolvedValue(session as any);

        const deleteOne = vi.fn();

        const user = {
            _id: { toString: () => 'target-1' },
            role: 'user',
            deleteOne,
        };

        const findSession = vi.fn().mockResolvedValue(user);
        vi.mocked(UserModel.findOne).mockReturnValue({
            session: findSession,
        } as any);

        const result = await AdminService.deleteUser('actor-1', ' Alice123 ');

        expect(UserModel.findOne).toHaveBeenCalledWith({ username: 'alice123' });
        expect(findSession).toHaveBeenCalledWith(session);
        expect(deleteOne).toHaveBeenCalledWith({ session });
        expect(result).toBe('alice123');
        expect(session.endSession).toHaveBeenCalled();
    });

    it('deletes an admin successfully when more than one admin exists', async () => {
        const session = makeSession();
        vi.mocked(mongoose.startSession).mockResolvedValue(session as any);

        const deleteOne = vi.fn();

        vi.mocked(UserModel.findOne).mockReturnValue({
            session: vi.fn().mockResolvedValue({
                _id: { toString: () => 'target-1' },
                role: 'admin',
                deleteOne,
            }),
        } as any);

        vi.mocked(UserModel.countDocuments).mockReturnValue({
            session: vi.fn().mockResolvedValue(2),
        } as any);

        const result = await AdminService.deleteUser('actor-1', 'alice123');

        expect(deleteOne).toHaveBeenCalledWith({ session });
        expect(result).toBe('alice123');
        expect(session.endSession).toHaveBeenCalled();
    });

    it('ends the session when delete fails', async () => {
        const session = makeSession();
        vi.mocked(mongoose.startSession).mockResolvedValue(session as any);

        vi.mocked(UserModel.findOne).mockReturnValue({
            session: vi.fn().mockResolvedValue({
                _id: { toString: () => 'target-1' },
                role: 'user',
                deleteOne: vi.fn().mockRejectedValue(new Error('delete failed')),
            }),
        } as any);

        await expect(AdminService.deleteUser('actor-1', 'alice123')).rejects.toThrow(
            'delete failed',
        );
        expect(session.endSession).toHaveBeenCalled();
    });
});

describe('AdminService.listUsers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns paginated users with no search or role filter', async () => {
        const sort = vi.fn().mockReturnThis();
        const skip = vi.fn().mockReturnThis();
        const limit = vi.fn().mockResolvedValue([
            {
                toJSON: vi.fn().mockReturnValue({
                    id: 'user-1',
                    username: 'alice123',
                    role: 'user',
                }),
            },
            {
                toJSON: vi.fn().mockReturnValue({
                    id: 'user-2',
                    username: 'bob123',
                    role: 'admin',
                }),
            },
        ]);

        vi.mocked(UserModel.find).mockReturnValue({
            sort,
            skip,
            limit,
        } as any);

        vi.mocked(UserModel.countDocuments).mockResolvedValue(2 as any);

        const result = await AdminService.listUsers({
            page: 1,
            limit: 10,
        });

        expect(UserModel.find).toHaveBeenCalledWith({});
        expect(UserModel.countDocuments).toHaveBeenCalledWith({});
        expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
        expect(skip).toHaveBeenCalledWith(0);
        expect(limit).toHaveBeenCalledWith(10);

        expect(result).toEqual({
            users: [
                { id: 'user-1', username: 'alice123', role: 'user' },
                { id: 'user-2', username: 'bob123', role: 'admin' },
            ],
            pagination: {
                page: 1,
                limit: 10,
                total: 2,
                totalPages: 1,
            },
        });
    });

    it('applies role filter when role is provided', async () => {
        const sort = vi.fn().mockReturnThis();
        const skip = vi.fn().mockReturnThis();
        const limit = vi.fn().mockResolvedValue([]);

        vi.mocked(UserModel.find).mockReturnValue({
            sort,
            skip,
            limit,
        } as any);

        vi.mocked(UserModel.countDocuments).mockResolvedValue(0 as any);

        await AdminService.listUsers({
            role: 'admin',
            page: 1,
            limit: 10,
        });

        expect(UserModel.find).toHaveBeenCalledWith({
            role: 'admin',
        });
        expect(UserModel.countDocuments).toHaveBeenCalledWith({
            role: 'admin',
        });
    });

    it('applies escaped regex search across username, displayName, and email', async () => {
        const sort = vi.fn().mockReturnThis();
        const skip = vi.fn().mockReturnThis();
        const limit = vi.fn().mockResolvedValue([]);

        vi.mocked(UserModel.find).mockReturnValue({
            sort,
            skip,
            limit,
        } as any);

        vi.mocked(UserModel.countDocuments).mockResolvedValue(0 as any);

        await AdminService.listUsers({
            search: 'alice.*',
            page: 2,
            limit: 5,
        });

        expect(UserModel.find).toHaveBeenCalledTimes(1);
        expect(UserModel.countDocuments).toHaveBeenCalledTimes(1);

        const filterArg = vi.mocked(UserModel.find).mock.calls[0][0] as unknown as {
            $or: Array<Record<string, RegExp>>;
        };

        expect(filterArg.$or).toHaveLength(3);

        const usernameRegex = filterArg.$or[0].username;
        const displayNameRegex = filterArg.$or[1].displayName;
        const emailRegex = filterArg.$or[2].email;

        expect(usernameRegex).toBeInstanceOf(RegExp);
        expect(displayNameRegex).toBeInstanceOf(RegExp);
        expect(emailRegex).toBeInstanceOf(RegExp);

        expect(usernameRegex.test('alice.*')).toBe(true);
        expect(usernameRegex.test('alice123')).toBe(false);

        expect(skip).toHaveBeenCalledWith(5);
        expect(limit).toHaveBeenCalledWith(5);
    });

    it('combines role filter and search filter', async () => {
        const sort = vi.fn().mockReturnThis();
        const skip = vi.fn().mockReturnThis();
        const limit = vi.fn().mockResolvedValue([]);

        vi.mocked(UserModel.find).mockReturnValue({
            sort,
            skip,
            limit,
        } as any);

        vi.mocked(UserModel.countDocuments).mockResolvedValue(0 as any);

        await AdminService.listUsers({
            role: 'user',
            search: 'alice',
            page: 1,
            limit: 10,
        });

        const filterArg = vi.mocked(UserModel.find).mock.calls[0][0] as unknown as {
            role: string;
            $or: Array<Record<string, RegExp>>;
        };

        expect(filterArg.role).toBe('user');
        expect(filterArg.$or).toHaveLength(3);
    });

    it('computes totalPages correctly when total is not divisible by limit', async () => {
        const sort = vi.fn().mockReturnThis();
        const skip = vi.fn().mockReturnThis();
        const limit = vi.fn().mockResolvedValue([]);

        vi.mocked(UserModel.find).mockReturnValue({
            sort,
            skip,
            limit,
        } as any);

        vi.mocked(UserModel.countDocuments).mockResolvedValue(11 as any);

        const result = await AdminService.listUsers({
            page: 2,
            limit: 10,
        });

        expect(result.pagination).toEqual({
            page: 2,
            limit: 10,
            total: 11,
            totalPages: 2,
        });
    });
});
