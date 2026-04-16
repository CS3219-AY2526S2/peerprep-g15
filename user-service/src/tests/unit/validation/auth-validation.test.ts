import { describe, it, expect } from 'vitest';
import { loginSchema, registerSchema } from '../../../validation/auth-validation';

describe('registerSchema', () => {
    it('accepts a valid register payload', () => {
        const result = registerSchema.safeParse({
            username: 'alice123',
            displayName: 'Alice',
            email: 'ALICE@EXAMPLE.COM',
            password: 'password123',
        });

        expect(result.success).toBe(true);

        if (result.success) {
            expect(result.data.username).toBe('alice123');
            expect(result.data.displayName).toBe('Alice');
            expect(result.data.email).toBe('alice@example.com');
            expect(result.data.password).toBe('password123');
        }
    });

    it('rejects a username with spaces', () => {
        const result = registerSchema.safeParse({
            username: 'alice bob',
            email: 'alice@example.com',
            password: 'password123',
        });

        expect(result.success).toBe(false);
    });

    it('rejects a username that is too short', () => {
        const result = registerSchema.safeParse({
            username: 'ab',
            email: 'alice@example.com',
            password: 'password123',
        });

        expect(result.success).toBe(false);
    });

    it('rejects an invalid email', () => {
        const result = registerSchema.safeParse({
            username: 'alice123',
            email: 'not-an-email',
            password: 'password123',
        });

        expect(result.success).toBe(false);
    });

    it('rejects a password shorter than 8 characters', () => {
        const result = registerSchema.safeParse({
            username: 'alice123',
            email: 'alice@example.com',
            password: 'short',
        });

        expect(result.success).toBe(false);
    });

    it('allows displayName to be omitted', () => {
        const result = registerSchema.safeParse({
            username: 'alice123',
            email: 'alice@example.com',
            password: 'password123',
        });

        expect(result.success).toBe(true);
    });
});

describe('loginSchema', () => {
    it('accepts a valid login payload', () => {
        const result = loginSchema.safeParse({
            identifier: 'alice123',
            password: 'password123',
        });

        expect(result.success).toBe(true);
    });

    it('trims identifier and still accepts valid input', () => {
        const result = loginSchema.safeParse({
            identifier: '  alice123  ',
            password: 'password123',
        });

        expect(result.success).toBe(true);

        if (result.success) {
            expect(result.data.identifier).toBe('alice123');
        }
    });

    it('rejects an empty identifier', () => {
        const result = loginSchema.safeParse({
            identifier: '   ',
            password: 'password123',
        });

        expect(result.success).toBe(false);
    });

    it('rejects an empty password', () => {
        const result = loginSchema.safeParse({
            identifier: 'alice123',
            password: '',
        });

        expect(result.success).toBe(false);
    });
});
