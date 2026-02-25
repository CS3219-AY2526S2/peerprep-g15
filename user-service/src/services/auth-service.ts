import bcrypt from 'bcrypt';
import { UserModel } from '../models/user-model';
import { signAccessToken } from '../utils/jwt';
import { AppError } from '../utils/app-error';

type RegisterInput = {
    username: string;
    email: string;
    password: string;
};

type LoginInput = {
    identifier: string;
    password: string;
};

export class AuthService {
    static async register(input: RegisterInput) {
        const username = input.username.trim();
        const email = input.email.trim().toLowerCase();
        const password = input.password;

        const existingUsername = await UserModel.findOne({ username }).lean();
        if (existingUsername) throw AppError.conflict('Username already in use');

        const existingEmail = await UserModel.findOne({ email }).lean();
        if (existingEmail) throw AppError.conflict('Email already in use');

        const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const userDoc = await UserModel.create({
            username,
            email,
            passwordHash,
            role: 'user',
            preferredLanguages: [],
            skillLevel: 'beginner',
        });

        const token = signAccessToken({ sub: userDoc._id.toString(), role: userDoc.role });
        return { user: userDoc.toJSON(), token };
    }

    static async login(input: LoginInput) {
        const identifierRaw = input.identifier.trim();
        const password = input.password;

        const isEmail = identifierRaw.includes('@');
        const query = isEmail
            ? { email: identifierRaw.toLowerCase() }
            : { username: identifierRaw };

        const userDoc = await UserModel.findOne(query);
        if (!userDoc) throw AppError.unauthorized('Invalid credentials');

        const ok = await bcrypt.compare(password, userDoc.passwordHash);
        if (!ok) throw AppError.unauthorized('Invalid credentials');

        const token = signAccessToken({ sub: userDoc._id.toString(), role: userDoc.role });
        return { user: userDoc.toJSON(), token };
    }
}
