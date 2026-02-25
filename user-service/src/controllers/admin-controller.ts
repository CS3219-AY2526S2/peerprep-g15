import type { Request, Response, NextFunction } from 'express';
import { getAuth } from '../utils/auth';

export class AdminController {
    static async home(req: Request, res: Response, next: NextFunction) {
        try {
            const auth = getAuth(req);

            res.json({
                message: 'Welcome, admin!',
                auth,
            });
        } catch (err) {
            next(err);
        }
    }
}
