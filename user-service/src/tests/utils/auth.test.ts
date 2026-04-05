import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import { getAuth } from '../../utils/auth';

describe('getAuth', () => {
    it('returns null when req.auth is missing', () => {
        const req = {} as Request;

        expect(getAuth(req)).toBeNull();
    });

    it('returns null when req.auth has no userId', () => {
        const req = {
            auth: {
                role: 'user',
            },
        } as unknown as Request;

        expect(getAuth(req)).toBeNull();
    });

    it('returns auth info when req.auth is present', () => {
        const req = {
            auth: {
                userId: 'user-1',
                role: 'admin',
            },
        } as unknown as Request;

        expect(getAuth(req)).toEqual({
            userId: 'user-1',
            role: 'admin',
        });
    });
});
