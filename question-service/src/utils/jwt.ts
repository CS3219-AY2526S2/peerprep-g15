import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';
import type { Role } from '../utils/user';

export type JwtPayload = {
    sub: string;
    role: Role;
    type: 'access' | 'refresh';
};

// Helper to ensure required env vars are present
function mustGetEnv(name: string): string {
    const v = process.env[name];
    if (!v) throw new Error(`${name} is missing`);
    return v;
}

export function verifyAccessToken(token: string): JwtPayload {
    const secret = mustGetEnv('JWT_SECRET') as Secret;
    const decoded = jwt.verify(token, secret) as JwtPayload;
    if (decoded.type !== 'access') throw new Error('Not an access token');
    return decoded;
}

export function verifyRefreshToken(token: string): JwtPayload {
    const secret = mustGetEnv('JWT_REFRESH_SECRET') as Secret;
    const decoded = jwt.verify(token, secret) as JwtPayload;
    if (decoded.type !== 'refresh') throw new Error('Not a refresh token');
    return decoded;
}
