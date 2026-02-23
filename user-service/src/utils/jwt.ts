import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';

export type JwtPayload = {
    sub: string;
    role: string;
};

export function signAccessToken(payload: JwtPayload): string {
    const secret = process.env.JWT_SECRET as Secret;
    if (!secret) throw new Error('JWT_SECRET is missing');

    const expiresIn = (process.env.JWT_EXPIRES_IN ?? '1h') as SignOptions['expiresIn'];

    const options: SignOptions = { expiresIn };

    return jwt.sign(payload, secret, options);
}
