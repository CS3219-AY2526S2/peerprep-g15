import type { RequestHandler } from 'express';
import { z, ZodError } from 'zod';
import { AppError } from '../utils/app-error';

export function validateBody<T extends z.ZodTypeAny>(schema: T): RequestHandler {
    return (req, _res, next) => {
        try {
            req.body = schema.parse(req.body);
            next();
        } catch (err) {
            if (err instanceof ZodError) {
                return next(AppError.badRequest('Invalid request body', err.flatten()));
            }
            next(err);
        }
    };
}
