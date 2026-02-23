import bcrypt from 'bcrypt';
import { UserModel } from '../models/user-model';
import { signAccessToken } from '../utils/jwt';

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

        if (username.length < 3) throw new Error('Username must be at least 3 characters');
        if (!email.includes('@')) throw new Error('Email must be valid');
        if (password.length < 8) throw new Error('Password must be at least 8 characters');

        const existing_username = await UserModel.findOne({ username }).lean();
        if (existing_username) throw new Error('Username already in use');
        const existing_email = await UserModel.findOne({ email }).lean();
        if (existing_email) throw new Error('Email already in use');

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
        const identifierRaw = (input.identifier ?? '').trim();
        const password = input.password;

        if (!identifierRaw) throw new Error('Identifier is required');
        if (!password) throw new Error('Password is required');

        const isEmail = identifierRaw.includes('@');

        const query = isEmail
            ? { email: identifierRaw.toLowerCase() }
            : { username: identifierRaw };

        const userDoc = await UserModel.findOne(query);
        if (!userDoc) throw new Error('Invalid credentials');

        const ok = await bcrypt.compare(password, userDoc.passwordHash);
        if (!ok) throw new Error('Invalid credentials');

        const token = signAccessToken({ sub: userDoc._id.toString(), role: userDoc.role });

        return { user: userDoc.toJSON(), token };
    }
}
