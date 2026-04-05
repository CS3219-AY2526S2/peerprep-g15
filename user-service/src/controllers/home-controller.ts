import type { Request, Response, NextFunction } from 'express';
import { UserModel } from '../models/user-model';
import { getAuth } from '../utils/auth';
import { AppError } from '../utils/app-error';

// This page should eventually be starting point of queueing and matching
export class HomeController {
    static async home(req: Request, res: Response, next: NextFunction) {
        try {
            const auth = getAuth(req);
            if (!auth) return next(AppError.unauthorized('Unauthorized'));

            const user = await UserModel.findById(auth.userId);
            if (!user) return next(AppError.notFound('User not found'));

            return res.status(200).json({
                message: 'User home',
                user: user.toJSON(),
            });
        } catch (err) {
            next(err);
        }
    }
}
