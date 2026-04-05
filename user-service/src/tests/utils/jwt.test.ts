import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    signAccessToken,
    signRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
} from '../../utils/jwt';

describe('jwt utils', () => {
    beforeEach(() => {
        vi.stubEnv('JWT_SECRET', 'test-access-secret');
        vi.stubEnv('JWT_REFRESH_SECRET', 'test-refresh-secret');
        vi.stubEnv('JWT_EXPIRES_IN', '15m');
        vi.stubEnv('JWT_REFRESH_EXPIRES_IN', '7d');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('signs and verifies an access token', () => {
        const token = signAccessToken({
            sub: 'user-1',
            role: 'admin',
        });

        const payload = verifyAccessToken(token);

        expect(payload.sub).toBe('user-1');
        expect(payload.role).toBe('admin');
        expect(payload.type).toBe('access');
    });

    it('signs and verifies a refresh token', () => {
        const token = signRefreshToken({
            sub: 'user-1',
            role: 'user',
        });

        const payload = verifyRefreshToken(token);

        expect(payload.sub).toBe('user-1');
        expect(payload.role).toBe('user');
        expect(payload.type).toBe('refresh');
    });

    it('rejects verifying a refresh token as an access token', () => {
        const token = signRefreshToken({
            sub: 'user-1',
            role: 'user',
        });

        expect(() => verifyAccessToken(token)).toThrow();
    });

    it('rejects verifying an access token as a refresh token', () => {
        const token = signAccessToken({
            sub: 'user-1',
            role: 'user',
        });

        expect(() => verifyRefreshToken(token)).toThrow();
    });
});
