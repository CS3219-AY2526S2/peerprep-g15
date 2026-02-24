import type { NextFunction, Request, Response } from 'express';
import jwt, { type JwtPayload, type Secret } from 'jsonwebtoken';
import type { Role } from '../models/user-model';

export interface AuthenticatedRequest extends Request {
    auth: {
        userId: string;
        role: Role;
    };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
    try {
        const header = req.headers.authorization ?? '';
        const [scheme, token] = header.split(' ');

        if (scheme !== 'Bearer' || !token) {
            return res
                .status(401)
                .json({ error: { message: 'Missing or invalid Authorization header' } });
        }

        const secret = process.env.JWT_SECRET as Secret;
        if (!secret) {
            return res.status(500).json({ error: { message: 'JWT_SECRET is missing' } });
        }

        const decoded = jwt.verify(token, secret) as JwtPayload;

        const userId = decoded.sub;
        const role = (decoded as any).role as Role;

        if (!userId) {
            return res.status(401).json({ error: { message: 'Invalid token payload' } });
        }

        (req as any).auth = { userId, role };

        return next();
    } catch {
        return res.status(401).json({ error: { message: 'Invalid or expired token' } });
    }
}
