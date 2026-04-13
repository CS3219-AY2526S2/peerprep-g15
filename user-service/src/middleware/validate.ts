import type { Request, RequestHandler } from 'express';
import { z, ZodError } from 'zod';
import { AppError } from '../utils/app-error';

export interface ValidatedQueryRequest<T = unknown> extends Request {
    validatedQuery?: T;
}

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

export function validateQuery<T extends z.ZodTypeAny>(schema: T): RequestHandler {
    return (req, _res, next) => {
        try {
            (req as ValidatedQueryRequest<z.infer<T>>).validatedQuery = schema.parse(req.query);
            next();
        } catch (err) {
            if (err instanceof ZodError) {
                return next(AppError.badRequest('Invalid query parameters', err.flatten()));
            }
            next(err);
        }
    };
}
