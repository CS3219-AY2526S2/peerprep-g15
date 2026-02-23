import type { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth-service';

export class AuthController {
    static async register(req: Request, res: Response, next: NextFunction) {
        try {
            const { username, email, password } = req.body ?? {};
            const result = await AuthService.register({ username, email, password });
            res.status(201).json(result);
        } catch (err) {
            next(err);
        }
    }

    static async login(req: Request, res: Response, next: NextFunction) {
        try {
            const { identifier, password } = req.body ?? {};
            const result = await AuthService.login({ identifier, password });
            res.status(200).json(result);
        } catch (err) {
            next(err);
        }
    }
}
