import bcrypt from 'bcrypt';
import { UserModel, type SkillLevel } from '../models/user-model';
import { AppError } from '../utils/app-error';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { sha256 } from '../utils/token';

type RegisterInput = {
    username: string;
    displayName?: string;
    email: string;
    password: string;
    preferredLanguages?: string[];
    skillLevel?: SkillLevel;
};

type LoginInput = {
    identifier: string;
    password: string;
};

export class AuthService {
    private static issueTokens(userId: string, role: string) {
        const accessToken = signAccessToken({ sub: userId, role });
        const refreshToken = signRefreshToken({ sub: userId, role });
        return { accessToken, refreshToken };
    }

    static async register(input: RegisterInput) {
        const username = input.username.trim().toLowerCase();
        const email = input.email.trim().toLowerCase();
        const displayName = input.displayName?.trim() || username;
        const password = input.password;

        const existingUsername = await UserModel.findOne({ username }).lean();
        if (existingUsername) throw AppError.conflict('Username already in use');

        const existingEmail = await UserModel.findOne({ email }).lean();
        if (existingEmail) throw AppError.conflict('Email already in use');

        const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const userDoc = await UserModel.create({
            username,
            displayName,
            email,
            passwordHash,
            role: 'user',
            preferredLanguages: input.preferredLanguages ?? [],
            skillLevel: input.skillLevel ?? 'beginner',
            refreshTokenHash: null,
            refreshTokenIssuedAt: null,
        });

        // Issue both access + refresh tokens on registration
        const { accessToken, refreshToken } = this.issueTokens(
            userDoc._id.toString(),
            userDoc.role,
        );

        // Store hash of refresh token in DB
        userDoc.refreshTokenHash = sha256(refreshToken);
        userDoc.refreshTokenIssuedAt = new Date();
        await userDoc.save();

        return { user: userDoc.toJSON(), accessToken, refreshToken };
    }

    static async login(input: LoginInput) {
        const identifierRaw = input.identifier.trim();
        const password = input.password;

        const isEmail = identifierRaw.includes('@');
        const query = isEmail
            ? { email: identifierRaw.toLowerCase() }
            : { username: identifierRaw.toLowerCase() };

        const userDoc = await UserModel.findOne(query);
        if (!userDoc) throw AppError.unauthorized('Invalid credentials');

        const ok = await bcrypt.compare(password, userDoc.passwordHash);
        if (!ok) throw AppError.unauthorized('Invalid credentials');

        // Similarly, issue both access + refresh tokens on login
        const { accessToken, refreshToken } = this.issueTokens(
            userDoc._id.toString(),
            userDoc.role,
        );

        // Similarly, store hash of refresh token
        userDoc.refreshTokenHash = sha256(refreshToken);
        userDoc.refreshTokenIssuedAt = new Date();
        await userDoc.save();

        return { user: userDoc.toJSON(), accessToken, refreshToken };
    }

    static async refresh(refreshToken: string) {
        let payload: { sub: string; role: string };

        // If token is invalid/expired
        try {
            payload = verifyRefreshToken(refreshToken);
        } catch {
            throw AppError.unauthorized('Invalid or expired refresh token');
        }

        // If we can't find the user or the user doesn't have a refresh token hash
        const userDoc = await UserModel.findById(payload.sub);
        if (!userDoc) throw AppError.unauthorized('Invalid refresh token');

        // If the hash of the provided refresh token doesn't match the stored hash
        const incomingHash = sha256(refreshToken);
        if (!userDoc.refreshTokenHash || userDoc.refreshTokenHash !== incomingHash) {
            throw AppError.unauthorized('Refresh token has been revoked');
        }

        // Else, refresh token is valid
        const { accessToken, refreshToken: newRefreshToken } = this.issueTokens(
            userDoc._id.toString(),
            userDoc.role,
        );

        userDoc.refreshTokenHash = sha256(newRefreshToken);
        userDoc.refreshTokenIssuedAt = new Date();
        await userDoc.save();

        return { accessToken, refreshToken: newRefreshToken };
    }

    // Controller will clear cookies so just need to invalidate the refresh token server-side
    static async logoutByRefreshToken(refreshToken: string) {
        let payload: { sub: string; role: string };

        // Ensure logout succeeds even if token is invalid/expired
        try {
            payload = verifyRefreshToken(refreshToken);
        } catch {
            return;
        }

        const userDoc = await UserModel.findById(payload.sub);
        if (!userDoc) return;

        userDoc.refreshTokenHash = null;
        userDoc.refreshTokenIssuedAt = null;
        await userDoc.save();
    }
}
