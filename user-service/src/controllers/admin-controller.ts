import type { Request, Response, NextFunction } from 'express';
import { getAuth } from '../utils/auth';
import { AppError } from '../utils/app-error';

// This page should eventually be where admins have CRUD access to questions
export class AdminController {
    static async home(req: Request, res: Response, next: NextFunction) {
        try {
            const auth = getAuth(req);
            if (!auth) return next(AppError.unauthorized('Unauthorized'));

            return res.status(200).json({
                message: 'Admin home',
                auth,
            });
        } catch (err) {
            next(err);
        }
    }
}
