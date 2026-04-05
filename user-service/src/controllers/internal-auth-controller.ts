import type { Request, Response, NextFunction } from 'express';
import { InternalAuthService } from '../services/internal-auth-service';

export class InternalAuthController {
    static async resolve(req: Request, res: Response, next: NextFunction) {
        try {
            const { accessToken } = req.body;
            const user = await InternalAuthService.resolve(accessToken);

            return res.status(200).json({ user });
        } catch (err) {
            next(err);
        }
    }
}
