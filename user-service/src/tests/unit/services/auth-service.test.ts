import { beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcrypt';
import { AuthService } from '../../../services/auth-service';

vi.mock('bcrypt', () => ({
    default: {
        hash: vi.fn(),
        compare: vi.fn(),
    },
}));

vi.mock('../../../models/user-model', () => ({
    UserModel: {
        findOne: vi.fn(),
        findById: vi.fn(),
        create: vi.fn(),
    },
}));

vi.mock('../../../utils/jwt', () => ({
    signAccessToken: vi.fn(),
    signRefreshToken: vi.fn(),
    verifyRefreshToken: vi.fn(),
}));

vi.mock('../../../utils/token', () => ({
    sha256: vi.fn(),
}));

import { UserModel } from '../../../models/user-model';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../../utils/jwt';
import { sha256 } from '../../../utils/token';

describe('AuthService.register', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('throws conflict when username already exists', async () => {
        vi.mocked(UserModel.findOne).mockReturnValueOnce({
            lean: vi.fn().mockResolvedValue({ username: 'alice123' }),
        } as any);

        await expect(
            AuthService.register({
                username: 'alice123',
                email: 'alice@example.com',
                password: 'password123',
            }),
        ).rejects.toMatchObject({
            statusCode: 409,
            code: 'CONFLICT',
        });
    });

    it('throws conflict when email already exists', async () => {
        vi.mocked(UserModel.findOne)
            .mockReturnValueOnce({
                lean: vi.fn().mockResolvedValue(null),
            } as any)
            .mockReturnValueOnce({
                lean: vi.fn().mockResolvedValue({ email: 'alice@example.com' }),
            } as any);

        await expect(
            AuthService.register({
                username: 'alice123',
                email: 'alice@example.com',
                password: 'password123',
            }),
        ).rejects.toMatchObject({
            statusCode: 409,
            code: 'CONFLICT',
        });
    });

    it('registers a new user and stores hashed refresh token', async () => {
        vi.mocked(UserModel.findOne)
            .mockReturnValueOnce({
                lean: vi.fn().mockResolvedValue(null),
            } as any)
            .mockReturnValueOnce({
                lean: vi.fn().mockResolvedValue(null),
            } as any);

        vi.mocked(bcrypt.hash).mockResolvedValue('hashed-password' as never);
        vi.mocked(signAccessToken).mockReturnValue('access-token');
        vi.mocked(signRefreshToken).mockReturnValue('refresh-token');
        vi.mocked(sha256).mockReturnValue('hashed-refresh-token');

        const save = vi.fn();

        const createdUser = {
            _id: { toString: () => 'user-123' },
            role: 'user',
            refreshTokenHash: null,
            refreshTokenIssuedAt: null,
            save,
            toJSON: vi.fn().mockReturnValue({
                id: 'user-123',
                username: 'alice123',
                email: 'alice@example.com',
                role: 'user',
            }),
        };

        vi.mocked(UserModel.create).mockResolvedValue(createdUser as any);

        const result = await AuthService.register({
            username: 'Alice123',
            displayName: 'Alice',
            email: 'ALICE@EXAMPLE.COM',
            password: 'password123',
        });

        expect(UserModel.create).toHaveBeenCalled();
        expect(createdUser.refreshTokenHash).toBe('hashed-refresh-token');
        expect(createdUser.refreshTokenIssuedAt).toBeInstanceOf(Date);
        expect(save).toHaveBeenCalled();

        expect(result).toEqual({
            user: {
                id: 'user-123',
                username: 'alice123',
                email: 'alice@example.com',
                role: 'user',
            },
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
        });
    });
});

describe('AuthService.login', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('throws unauthorized when user is not found', async () => {
        vi.mocked(UserModel.findOne).mockResolvedValue(null);

        await expect(
            AuthService.login({
                identifier: 'alice123',
                password: 'password123',
            }),
        ).rejects.toMatchObject({
            statusCode: 401,
            code: 'UNAUTHORIZED',
        });
    });

    it('throws unauthorized when password is incorrect', async () => {
        vi.mocked(UserModel.findOne).mockResolvedValue({
            passwordHash: 'stored-hash',
        } as any);

        vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

        await expect(
            AuthService.login({
                identifier: 'alice123',
                password: 'wrongpassword',
            }),
        ).rejects.toMatchObject({
            statusCode: 401,
            code: 'UNAUTHORIZED',
        });
    });

    it('logs in successfully and rotates refresh session state', async () => {
        vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
        vi.mocked(signAccessToken).mockReturnValue('access-token');
        vi.mocked(signRefreshToken).mockReturnValue('refresh-token');
        vi.mocked(sha256).mockReturnValue('hashed-refresh-token');

        const save = vi.fn();

        const userDoc = {
            _id: { toString: () => 'user-123' },
            role: 'admin',
            passwordHash: 'stored-hash',
            refreshTokenHash: null,
            refreshTokenIssuedAt: null,
            save,
            toJSON: vi.fn().mockReturnValue({
                id: 'user-123',
                username: 'alice123',
                role: 'admin',
            }),
        };

        vi.mocked(UserModel.findOne).mockResolvedValue(userDoc as any);

        const result = await AuthService.login({
            identifier: 'alice123',
            password: 'password123',
        });

        expect(userDoc.refreshTokenHash).toBe('hashed-refresh-token');
        expect(userDoc.refreshTokenIssuedAt).toBeInstanceOf(Date);
        expect(save).toHaveBeenCalled();

        expect(result).toEqual({
            user: {
                id: 'user-123',
                username: 'alice123',
                role: 'admin',
            },
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
        });
    });
});

describe('AuthService.refresh', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('throws unauthorized when refresh token is invalid', async () => {
        vi.mocked(verifyRefreshToken).mockImplementation(() => {
            throw new Error('bad refresh token');
        });

        await expect(AuthService.refresh('bad-token')).rejects.toMatchObject({
            statusCode: 401,
            code: 'UNAUTHORIZED',
        });
    });

    it('throws unauthorized when user no longer exists', async () => {
        vi.mocked(verifyRefreshToken).mockReturnValue({
            sub: 'user-123',
            role: 'user',
            type: 'refresh',
        });

        vi.mocked(UserModel.findById).mockResolvedValue(null);

        await expect(AuthService.refresh('refresh-token')).rejects.toMatchObject({
            statusCode: 401,
            code: 'UNAUTHORIZED',
        });
    });

    it('throws unauthorized when stored refresh token hash does not match', async () => {
        vi.mocked(verifyRefreshToken).mockReturnValue({
            sub: 'user-123',
            role: 'user',
            type: 'refresh',
        });

        vi.mocked(sha256).mockReturnValue('incoming-hash');

        vi.mocked(UserModel.findById).mockResolvedValue({
            refreshTokenHash: 'different-hash',
        } as any);

        await expect(AuthService.refresh('refresh-token')).rejects.toMatchObject({
            statusCode: 401,
            code: 'UNAUTHORIZED',
        });
    });

    it('returns a new access token and refresh token when refresh succeeds', async () => {
        vi.mocked(verifyRefreshToken).mockReturnValue({
            sub: 'user-123',
            role: 'user',
            type: 'refresh',
        });

        vi.mocked(signAccessToken).mockReturnValue('new-access-token');
        vi.mocked(signRefreshToken).mockReturnValue('new-refresh-token');

        vi.mocked(sha256)
            .mockReturnValueOnce('incoming-hash')
            .mockReturnValueOnce('new-hashed-refresh-token');

        const save = vi.fn();

        const userDoc = {
            _id: { toString: () => 'user-123' },
            role: 'user',
            refreshTokenHash: 'incoming-hash',
            refreshTokenIssuedAt: null,
            save,
        };

        vi.mocked(UserModel.findById).mockResolvedValue(userDoc as any);

        const result = await AuthService.refresh('refresh-token');

        expect(userDoc.refreshTokenHash).toBe('new-hashed-refresh-token');
        expect(userDoc.refreshTokenIssuedAt).toBeInstanceOf(Date);
        expect(save).toHaveBeenCalled();

        expect(result).toEqual({
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
        });
    });
});

describe('AuthService.logoutByRefreshToken', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns silently when refresh token is invalid', async () => {
        vi.mocked(verifyRefreshToken).mockImplementation(() => {
            throw new Error('bad refresh token');
        });

        await expect(AuthService.logoutByRefreshToken('bad-token')).resolves.toBeUndefined();
    });

    it('returns silently when user does not exist', async () => {
        vi.mocked(verifyRefreshToken).mockReturnValue({
            sub: 'user-123',
            role: 'user',
            type: 'refresh',
        });

        vi.mocked(UserModel.findById).mockResolvedValue(null);

        await expect(AuthService.logoutByRefreshToken('refresh-token')).resolves.toBeUndefined();
    });

    it('clears refresh session state when logout succeeds', async () => {
        vi.mocked(verifyRefreshToken).mockReturnValue({
            sub: 'user-123',
            role: 'user',
            type: 'refresh',
        });

        const save = vi.fn();

        const userDoc = {
            refreshTokenHash: 'old-hash',
            refreshTokenIssuedAt: new Date(),
            save,
        };

        vi.mocked(UserModel.findById).mockResolvedValue(userDoc as any);

        await AuthService.logoutByRefreshToken('refresh-token');

        expect(userDoc.refreshTokenHash).toBeNull();
        expect(userDoc.refreshTokenIssuedAt).toBeNull();
        expect(save).toHaveBeenCalled();
    });
});
