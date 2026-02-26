import type { Request, Response, NextFunction } from 'express';
import { getAuth } from '../utils/auth';
import { AppError } from '../utils/app-error';
import { MeService } from '../services/me-service';

export class MeController {
    static async me(req: Request, res: Response, next: NextFunction) {
        try {
            const auth = getAuth(req);
            if (!auth) return next(AppError.unauthorized('Unauthorized'));

            const user = await MeService.getMe(auth.userId);
            return res.status(200).json({ user });
        } catch (err) {
            next(err);
        }
    }

    static async update(req: Request, res: Response, next: NextFunction) {
        try {
            const auth = getAuth(req);
            if (!auth) return next(AppError.unauthorized('Unauthorized'));

            const user = await MeService.updateMe(auth.userId, req.body);
            return res.status(200).json({ user });
        } catch (err) {
            next(err);
        }
    }
}
