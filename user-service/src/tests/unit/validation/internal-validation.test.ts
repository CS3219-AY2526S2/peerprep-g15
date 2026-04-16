import { describe, it, expect } from 'vitest';
import { resolveAuthSchema } from '../../../validation/internal-validation';

describe('resolveAuthSchema', () => {
    it('accepts a valid access token', () => {
        const result = resolveAuthSchema.safeParse({
            accessToken: 'some-access-token',
        });

        expect(result.success).toBe(true);

        if (result.success) {
            expect(result.data.accessToken).toBe('some-access-token');
        }
    });

    it('trims accessToken', () => {
        const result = resolveAuthSchema.safeParse({
            accessToken: '  some-access-token  ',
        });

        expect(result.success).toBe(true);

        if (result.success) {
            expect(result.data.accessToken).toBe('some-access-token');
        }
    });

    it('rejects missing accessToken', () => {
        const result = resolveAuthSchema.safeParse({});

        expect(result.success).toBe(false);
    });

    it('rejects empty accessToken', () => {
        const result = resolveAuthSchema.safeParse({
            accessToken: '   ',
        });

        expect(result.success).toBe(false);
    });
});
