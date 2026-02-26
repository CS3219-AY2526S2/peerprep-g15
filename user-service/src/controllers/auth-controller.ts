import type { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth-service';

export class AuthController {
    static async register(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await AuthService.register(req.body);
            res.status(201).json(result);
        } catch (err) {
            next(err);
        }
    }

    static async login(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await AuthService.login(req.body);
            res.status(200).json(result);
        } catch (err) {
            next(err);
        }
    }

    static async logout(_req: Request, res: Response, next: NextFunction) {
        try {
            res.status(200).json({ message: 'Logged out' });
        } catch (err) {
            next(err);
        }
    }
}
