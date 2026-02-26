import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';

export type JwtPayload = {
    sub: string;
    role: string;
    type: 'access' | 'refresh';
};

// Helper to ensure required env vars are present
function mustGetEnv(name: string): string {
    const v = process.env[name];
    if (!v) throw new Error(`${name} is missing`);
    return v;
}

// Access tokens are short-lived and used for authentication
export function signAccessToken(payload: Omit<JwtPayload, 'type'>): string {
    const secret = mustGetEnv('JWT_SECRET') as Secret;
    const expiresIn = (process.env.JWT_EXPIRES_IN ?? '15m') as SignOptions['expiresIn'];
    return jwt.sign({ ...payload, type: 'access' } satisfies JwtPayload, secret, { expiresIn });
}

// Refresh tokens are long-lived and used to obtain new access tokens
export function signRefreshToken(payload: Omit<JwtPayload, 'type'>): string {
    const secret = mustGetEnv('JWT_REFRESH_SECRET') as Secret;
    const expiresIn = (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as SignOptions['expiresIn'];
    return jwt.sign({ ...payload, type: 'refresh' } satisfies JwtPayload, secret, { expiresIn });
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
