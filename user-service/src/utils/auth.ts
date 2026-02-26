import type { Request } from 'express';
import type { Role } from '../models/user-model';

export type AuthInfo = {
    userId: string;
    role: Role;
};

export function getAuth(req: Request): AuthInfo | null {
    const auth = (req as any).auth as AuthInfo | undefined;
    if (!auth?.userId) return null;
    return auth;
}
