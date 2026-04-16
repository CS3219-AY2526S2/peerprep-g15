import bcrypt from 'bcrypt';
import { UserModel, type Role, type SkillLevel } from '../../models/user-model';
import { signAccessToken, signRefreshToken } from '../../utils/jwt';
import { sha256 } from '../../utils/token';

type CreateUserInput = {
    username?: string;
    displayName?: string;
    email?: string;
    password?: string;
    role?: Role;
    preferredLanguages?: string[];
    skillLevel?: SkillLevel;
};

export async function createTestUser(input: CreateUserInput = {}) {
    const password = input.password ?? 'password123';
    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 4;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const user = await UserModel.create({
        username: input.username ?? 'testuser',
        displayName: input.displayName ?? 'Test User',
        email: input.email ?? 'testuser@example.com',
        passwordHash,
        role: input.role ?? 'user',
        preferredLanguages: input.preferredLanguages ?? [],
        skillLevel: input.skillLevel ?? 'beginner',
        refreshTokenHash: null,
        refreshTokenIssuedAt: null,
    });

    return { user, password };
}

export function makeAccessToken(userId: string, role: Role) {
    return signAccessToken({ sub: userId, role });
}

export async function issueStoredRefreshToken(userId: string, role: Role) {
    const refreshToken = signRefreshToken({ sub: userId, role });
    await UserModel.findByIdAndUpdate(userId, {
        refreshTokenHash: sha256(refreshToken),
        refreshTokenIssuedAt: new Date(),
    });
    return refreshToken;
}
