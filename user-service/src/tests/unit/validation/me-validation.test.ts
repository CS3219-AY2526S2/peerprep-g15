import { describe, it, expect } from 'vitest';
import { updateMeSchema } from '../../../validation/me-validation';

describe('updateMeSchema', () => {
    it('accepts a valid username update and lowercases it', () => {
        const result = updateMeSchema.safeParse({
            username: 'Alice123',
        });

        expect(result.success).toBe(true);

        if (result.success) {
            expect(result.data.username).toBe('alice123');
        }
    });

    it('accepts a valid email update and lowercases it', () => {
        const result = updateMeSchema.safeParse({
            email: 'ALICE@EXAMPLE.COM',
        });

        expect(result.success).toBe(true);

        if (result.success) {
            expect(result.data.email).toBe('alice@example.com');
        }
    });

    it('accepts a valid displayName update', () => {
        const result = updateMeSchema.safeParse({
            displayName: 'Alice Tan',
        });

        expect(result.success).toBe(true);
    });

    it('accepts valid preferredLanguages and skillLevel', () => {
        const result = updateMeSchema.safeParse({
            preferredLanguages: ['python', 'typescript'],
            skillLevel: 'intermediate',
        });

        expect(result.success).toBe(true);
    });

    it('rejects an empty payload', () => {
        const result = updateMeSchema.safeParse({});

        expect(result.success).toBe(false);
    });

    it('rejects username with spaces', () => {
        const result = updateMeSchema.safeParse({
            username: 'alice bob',
        });

        expect(result.success).toBe(false);
    });

    it('rejects invalid email', () => {
        const result = updateMeSchema.safeParse({
            email: 'not-an-email',
        });

        expect(result.success).toBe(false);
    });

    it('rejects too many preferred languages', () => {
        const result = updateMeSchema.safeParse({
            preferredLanguages: Array.from({ length: 21 }, (_, i) => `lang-${i}`),
        });

        expect(result.success).toBe(false);
    });

    it('rejects an empty preferred language entry', () => {
        const result = updateMeSchema.safeParse({
            preferredLanguages: ['python', ''],
        });

        expect(result.success).toBe(false);
    });

    it('accepts password change when both currentPassword and newPassword are provided', () => {
        const result = updateMeSchema.safeParse({
            currentPassword: 'oldpassword123',
            newPassword: 'newpassword123',
        });

        expect(result.success).toBe(true);
    });

    it('rejects password change when currentPassword is missing', () => {
        const result = updateMeSchema.safeParse({
            newPassword: 'newpassword123',
        });

        expect(result.success).toBe(false);
    });

    it('rejects password change when newPassword is missing', () => {
        const result = updateMeSchema.safeParse({
            currentPassword: 'oldpassword123',
        });

        expect(result.success).toBe(false);
    });

    it('rejects a new password that is too short', () => {
        const result = updateMeSchema.safeParse({
            currentPassword: 'oldpassword123',
            newPassword: 'short',
        });

        expect(result.success).toBe(false);
    });
});
