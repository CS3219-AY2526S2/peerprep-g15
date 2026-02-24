import type { Request, Response, NextFunction } from 'express';
import { UserModel } from '../models/user-model';
import { getAuth } from '../utils/auth';

export class HomeController {
    static async home(req: Request, res: Response, next: NextFunction) {
        try {
            const auth = getAuth(req);
            if (!auth) {
                return res.status(401).json({ error: { message: 'Unauthorized' } });
            }

            const user = await UserModel.findById(auth.userId);
            if (!user) {
                return res.status(404).json({ error: { message: 'User not found' } });
            }

            return res.status(200).json({ user: user.toJSON() });
        } catch (err) {
            next(err);
        }
    }
}
