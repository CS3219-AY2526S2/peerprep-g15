import type { Request } from 'express';
import type { Role } from '../models/user-model';
import type { AuthenticatedRequest } from '../middleware/auth-middleware';

export type AuthInfo = {
    userId: string;
    role: Role;
};

export function getAuth(req: Request): AuthInfo | null {
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth?.userId) return null;
    return auth;
}
