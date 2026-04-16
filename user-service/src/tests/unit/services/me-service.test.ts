import { beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { MeService } from '../../../services/me-service';

vi.mock('bcrypt', () => ({
    default: {
        compare: vi.fn(),
        hash: vi.fn(),
    },
}));

vi.mock('mongoose', () => ({
    default: {
        startSession: vi.fn(),
    },
}));

vi.mock('../../../models/user-model', () => ({
    UserModel: {
        findById: vi.fn(),
        findOne: vi.fn(),
        countDocuments: vi.fn(),
    },
}));

import { UserModel } from '../../../models/user-model';

const makeSession = () => ({
    withTransaction: vi.fn(async (fn: () => Promise<unknown>) => await fn()),
    endSession: vi.fn(),
});

describe('MeService.getMe', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns serialized user when found', async () => {
        vi.mocked(UserModel.findById).mockResolvedValue({
            toJSON: vi.fn().mockReturnValue({
                id: 'user-1',
                username: 'alice123',
                email: 'alice@example.com',
                role: 'user',
            }),
        } as any);

        const result = await MeService.getMe('user-1');

        expect(result).toEqual({
            id: 'user-1',
            username: 'alice123',
            email: 'alice@example.com',
            role: 'user',
        });
    });

    it('throws not found when user does not exist', async () => {
        vi.mocked(UserModel.findById).mockResolvedValue(null);

        await expect(MeService.getMe('user-1')).rejects.toMatchObject({
            statusCode: 404,
            code: 'NOT_FOUND',
        });
    });
});

describe('MeService.updateMe', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('throws not found when user does not exist', async () => {
        vi.mocked(UserModel.findById).mockResolvedValue(null);

        await expect(MeService.updateMe('user-1', { displayName: 'Alice' })).rejects.toMatchObject({
            statusCode: 404,
            code: 'NOT_FOUND',
        });
    });

    it('updates displayName, preferredLanguages, and skillLevel', async () => {
        const save = vi.fn();
        const toJSON = vi.fn().mockReturnValue({
            id: 'user-1',
            username: 'alice123',
            displayName: 'Alice Tan',
            email: 'alice@example.com',
            preferredLanguages: ['python'],
            skillLevel: 'intermediate',
        });

        const userDoc = {
            username: 'alice123',
            displayName: 'Alice',
            email: 'alice@example.com',
            preferredLanguages: [],
            skillLevel: 'beginner',
            save,
            toJSON,
        };

        vi.mocked(UserModel.findById).mockResolvedValue(userDoc as any);

        const result = await MeService.updateMe('user-1', {
            displayName: 'Alice Tan',
            preferredLanguages: ['python'],
            skillLevel: 'intermediate',
        });

        expect(userDoc.displayName).toBe('Alice Tan');
        expect(userDoc.preferredLanguages).toEqual(['python']);
        expect(userDoc.skillLevel).toBe('intermediate');
        expect(save).toHaveBeenCalled();
        expect(result).toEqual({
            id: 'user-1',
            username: 'alice123',
            displayName: 'Alice Tan',
            email: 'alice@example.com',
            preferredLanguages: ['python'],
            skillLevel: 'intermediate',
        });
    });

    it('updates username when new username is unique', async () => {
        const save = vi.fn();
        const toJSON = vi.fn().mockReturnValue({
            id: 'user-1',
            username: 'alicetan',
        });

        const userDoc = {
            username: 'alice123',
            email: 'alice@example.com',
            save,
            toJSON,
        };

        vi.mocked(UserModel.findById).mockResolvedValue(userDoc as any);
        vi.mocked(UserModel.findOne).mockReturnValue({
            lean: vi.fn().mockResolvedValue(null),
        } as any);

        const result = await MeService.updateMe('user-1', {
            username: 'AliceTan',
        });

        expect(UserModel.findOne).toHaveBeenCalledWith({
            username: 'alicetan',
            _id: { $ne: 'user-1' },
        });
        expect(userDoc.username).toBe('alicetan');
        expect(save).toHaveBeenCalled();
        expect(result).toEqual({ id: 'user-1', username: 'alicetan' });
    });

    it('throws conflict when username is already in use', async () => {
        const userDoc = {
            username: 'alice123',
            email: 'alice@example.com',
        };

        vi.mocked(UserModel.findById).mockResolvedValue(userDoc as any);
        vi.mocked(UserModel.findOne).mockReturnValue({
            lean: vi.fn().mockResolvedValue({ username: 'alicetan' }),
        } as any);

        await expect(MeService.updateMe('user-1', { username: 'AliceTan' })).rejects.toMatchObject({
            statusCode: 409,
            code: 'CONFLICT',
        });
    });

    it('updates email when new email is unique', async () => {
        const save = vi.fn();
        const toJSON = vi.fn().mockReturnValue({
            id: 'user-1',
            email: 'alicetan@example.com',
        });

        const userDoc = {
            username: 'alice123',
            email: 'alice@example.com',
            save,
            toJSON,
        };

        vi.mocked(UserModel.findById).mockResolvedValue(userDoc as any);
        vi.mocked(UserModel.findOne).mockReturnValue({
            lean: vi.fn().mockResolvedValue(null),
        } as any);

        const result = await MeService.updateMe('user-1', {
            email: 'ALICETAN@EXAMPLE.COM',
        });

        expect(UserModel.findOne).toHaveBeenCalledWith({
            email: 'alicetan@example.com',
            _id: { $ne: 'user-1' },
        });
        expect(userDoc.email).toBe('alicetan@example.com');
        expect(save).toHaveBeenCalled();
        expect(result).toEqual({ id: 'user-1', email: 'alicetan@example.com' });
    });

    it('throws conflict when email is already in use', async () => {
        const userDoc = {
            username: 'alice123',
            email: 'alice@example.com',
        };

        vi.mocked(UserModel.findById).mockResolvedValue(userDoc as any);
        vi.mocked(UserModel.findOne).mockReturnValue({
            lean: vi.fn().mockResolvedValue({ email: 'alicetan@example.com' }),
        } as any);

        await expect(
            MeService.updateMe('user-1', { email: 'ALICETAN@EXAMPLE.COM' }),
        ).rejects.toMatchObject({
            statusCode: 409,
            code: 'CONFLICT',
        });
    });

    it('throws unauthorized when current password is incorrect', async () => {
        const userDoc = {
            username: 'alice123',
            email: 'alice@example.com',
            passwordHash: 'stored-hash',
        };

        vi.mocked(UserModel.findById).mockResolvedValue(userDoc as any);
        vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

        await expect(
            MeService.updateMe('user-1', {
                currentPassword: 'wrong-password',
                newPassword: 'newpassword123',
            }),
        ).rejects.toMatchObject({
            statusCode: 401,
            code: 'UNAUTHORIZED',
        });
    });

    it('changes password and clears refresh session fields when current password is correct', async () => {
        const save = vi.fn();
        const toJSON = vi.fn().mockReturnValue({
            id: 'user-1',
            username: 'alice123',
        });

        const userDoc = {
            username: 'alice123',
            email: 'alice@example.com',
            passwordHash: 'stored-hash',
            refreshTokenHash: 'old-refresh-hash',
            refreshTokenIssuedAt: new Date(),
            save,
            toJSON,
        };

        vi.mocked(UserModel.findById).mockResolvedValue(userDoc as any);
        vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
        vi.mocked(bcrypt.hash).mockResolvedValue('new-password-hash' as never);

        const result = await MeService.updateMe('user-1', {
            currentPassword: 'oldpassword123',
            newPassword: 'newpassword123',
        });

        expect(userDoc.passwordHash).toBe('new-password-hash');
        expect(userDoc.refreshTokenHash).toBeNull();
        expect(userDoc.refreshTokenIssuedAt).toBeNull();
        expect(save).toHaveBeenCalled();
        expect(result).toEqual({
            id: 'user-1',
            username: 'alice123',
        });
    });
});

describe('MeService.deleteMe', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('throws not found when user does not exist', async () => {
        const session = makeSession();
        vi.mocked(mongoose.startSession).mockResolvedValue(session as any);

        vi.mocked(UserModel.findById).mockReturnValue({
            session: vi.fn().mockResolvedValue(null),
        } as any);

        await expect(MeService.deleteMe('user-1')).rejects.toMatchObject({
            statusCode: 404,
            code: 'NOT_FOUND',
        });

        expect(session.endSession).toHaveBeenCalled();
    });

    it('throws forbidden when deleting the last remaining admin', async () => {
        const session = makeSession();
        vi.mocked(mongoose.startSession).mockResolvedValue(session as any);

        vi.mocked(UserModel.findById).mockReturnValue({
            session: vi.fn().mockResolvedValue({
                role: 'admin',
            }),
        } as any);

        const countSession = vi.fn().mockResolvedValue(1);
        vi.mocked(UserModel.countDocuments).mockReturnValue({
            session: countSession,
        } as any);

        await expect(MeService.deleteMe('user-1')).rejects.toMatchObject({
            statusCode: 403,
            code: 'FORBIDDEN',
        });

        expect(UserModel.countDocuments).toHaveBeenCalledWith({ role: 'admin' });
        expect(countSession).toHaveBeenCalledWith(session);
        expect(session.endSession).toHaveBeenCalled();
    });

    it('deletes a normal user successfully', async () => {
        const session = makeSession();
        vi.mocked(mongoose.startSession).mockResolvedValue(session as any);

        const deleteOne = vi.fn();

        vi.mocked(UserModel.findById).mockReturnValue({
            session: vi.fn().mockResolvedValue({
                role: 'user',
                deleteOne,
            }),
        } as any);

        await MeService.deleteMe('user-1');

        expect(mongoose.startSession).toHaveBeenCalled();
        expect(session.withTransaction).toHaveBeenCalled();
        expect(deleteOne).toHaveBeenCalledWith({ session });
        expect(session.endSession).toHaveBeenCalled();
    });

    it('deletes an admin successfully when more than one admin exists', async () => {
        const session = makeSession();
        vi.mocked(mongoose.startSession).mockResolvedValue(session as any);

        const deleteOne = vi.fn();

        vi.mocked(UserModel.findById).mockReturnValue({
            session: vi.fn().mockResolvedValue({
                role: 'admin',
                deleteOne,
            }),
        } as any);

        vi.mocked(UserModel.countDocuments).mockReturnValue({
            session: vi.fn().mockResolvedValue(2),
        } as any);

        await MeService.deleteMe('user-1');

        expect(deleteOne).toHaveBeenCalledWith({ session });
        expect(session.endSession).toHaveBeenCalled();
    });

    it('ends the session when delete fails', async () => {
        const session = makeSession();
        vi.mocked(mongoose.startSession).mockResolvedValue(session as any);

        vi.mocked(UserModel.findById).mockReturnValue({
            session: vi.fn().mockResolvedValue({
                role: 'user',
                deleteOne: vi.fn().mockRejectedValue(new Error('delete failed')),
            }),
        } as any);

        await expect(MeService.deleteMe('user-1')).rejects.toThrow('delete failed');
        expect(session.endSession).toHaveBeenCalled();
    });
});
