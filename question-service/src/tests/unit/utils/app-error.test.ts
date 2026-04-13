import { describe, expect, it } from 'vitest';
import { AppError } from '../../../utils/app-error';

describe('AppError', () => {
    it('creates badRequest correctly', () => {
        const err = AppError.badRequest('Bad input', { field: 'title' });

        expect(err).toBeInstanceOf(Error);
        expect(err.statusCode).toBe(400);
        expect(err.code).toBe('BAD_REQUEST');
        expect(err.message).toBe('Bad input');
        expect(err.details).toEqual({ field: 'title' });
    });

    it('creates unauthorized correctly', () => {
        const err = AppError.unauthorized('No token');

        expect(err.statusCode).toBe(401);
        expect(err.code).toBe('UNAUTHORIZED');
        expect(err.message).toBe('No token');
    });

    it('creates forbidden correctly', () => {
        const err = AppError.forbidden('Forbidden');

        expect(err.statusCode).toBe(403);
        expect(err.code).toBe('FORBIDDEN');
        expect(err.message).toBe('Forbidden');
    });

    it('creates notFound correctly', () => {
        const err = AppError.notFound('Missing');

        expect(err.statusCode).toBe(404);
        expect(err.code).toBe('NOT_FOUND');
        expect(err.message).toBe('Missing');
    });

    it('creates conflict correctly', () => {
        const err = AppError.conflict('Duplicate');

        expect(err.statusCode).toBe(409);
        expect(err.code).toBe('CONFLICT');
        expect(err.message).toBe('Duplicate');
    });
});
