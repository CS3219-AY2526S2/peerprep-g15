import { describe, it, expect } from 'vitest';
import { roleChangeSchema, listUsersQuerySchema } from '../../validation/admin-validation';

describe('roleChangeSchema', () => {
    it('accepts a valid username and lowercases it', () => {
        const result = roleChangeSchema.safeParse({
            username: 'Alice123',
        });

        expect(result.success).toBe(true);

        if (result.success) {
            expect(result.data.username).toBe('alice123');
        }
    });

    it('rejects username with spaces', () => {
        const result = roleChangeSchema.safeParse({
            username: 'alice bob',
        });

        expect(result.success).toBe(false);
    });

    it('rejects username that is too short', () => {
        const result = roleChangeSchema.safeParse({
            username: 'ab',
        });

        expect(result.success).toBe(false);
    });
});

describe('listUsersQuerySchema', () => {
    it('applies default page and limit when omitted', () => {
        const result = listUsersQuerySchema.safeParse({});

        expect(result.success).toBe(true);

        if (result.success) {
            expect(result.data.page).toBe(1);
            expect(result.data.limit).toBe(10);
            expect(result.data.search).toBeUndefined();
            expect(result.data.role).toBeUndefined();
        }
    });

    it('accepts valid search, role, page, and limit', () => {
        const result = listUsersQuerySchema.safeParse({
            search: 'alice',
            role: 'admin',
            page: '2',
            limit: '5',
        });

        expect(result.success).toBe(true);

        if (result.success) {
            expect(result.data.search).toBe('alice');
            expect(result.data.role).toBe('admin');
            expect(result.data.page).toBe(2);
            expect(result.data.limit).toBe(5);
        }
    });

    it('treats empty search as undefined', () => {
        const result = listUsersQuerySchema.safeParse({
            search: '   ',
        });

        expect(result.success).toBe(true);

        if (result.success) {
            expect(result.data.search).toBeUndefined();
        }
    });

    it('rejects invalid role', () => {
        const result = listUsersQuerySchema.safeParse({
            role: 'superadmin',
        });

        expect(result.success).toBe(false);
    });

    it('rejects page less than 1', () => {
        const result = listUsersQuerySchema.safeParse({
            page: '0',
        });

        expect(result.success).toBe(false);
    });

    it('rejects limit greater than 50', () => {
        const result = listUsersQuerySchema.safeParse({
            limit: '51',
        });

        expect(result.success).toBe(false);
    });
});
