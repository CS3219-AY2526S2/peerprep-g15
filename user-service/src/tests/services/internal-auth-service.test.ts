import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InternalAuthService } from '../../services/internal-auth-service';

vi.mock('../../utils/jwt', () => ({
    verifyAccessToken: vi.fn(),
}));

vi.mock('../../models/user-model', () => ({
    UserModel: {
        findById: vi.fn(),
    },
}));

import { verifyAccessToken } from '../../utils/jwt';
import { UserModel } from '../../models/user-model';

describe('InternalAuthService.resolve', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns the resolved user for a valid token and existing user', async () => {
        vi.mocked(verifyAccessToken).mockReturnValue({
            sub: 'user-123',
            role: 'admin',
            type: 'access',
        });

        vi.mocked(UserModel.findById).mockResolvedValue({
            _id: { toString: () => 'user-123' },
            username: 'alice123',
            displayName: 'Alice',
            email: 'alice@example.com',
            role: 'admin',
        } as any);

        const result = await InternalAuthService.resolve('valid-token');

        expect(result).toEqual({
            id: 'user-123',
            username: 'alice123',
            displayName: 'Alice',
            email: 'alice@example.com',
            role: 'admin',
        });
    });

    it('throws unauthorized when token is invalid', async () => {
        vi.mocked(verifyAccessToken).mockImplementation(() => {
            throw new Error('bad token');
        });

        await expect(InternalAuthService.resolve('bad-token')).rejects.toMatchObject({
            statusCode: 401,
            code: 'UNAUTHORIZED',
        });
    });

    it('throws unauthorized when user no longer exists', async () => {
        vi.mocked(verifyAccessToken).mockReturnValue({
            sub: 'user-123',
            role: 'user',
            type: 'access',
        });

        vi.mocked(UserModel.findById).mockResolvedValue(null);

        await expect(InternalAuthService.resolve('valid-token')).rejects.toMatchObject({
            statusCode: 401,
            code: 'UNAUTHORIZED',
        });
    });
});
